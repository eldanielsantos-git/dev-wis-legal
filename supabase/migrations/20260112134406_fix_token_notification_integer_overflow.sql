/*
  # Fix Integer Overflow in Token Notification Trigger

  ## Problem
  The trigger_token_limit_notification function uses INTEGER type for tokens,
  but token values can exceed 2,147,483,647 (integer max), causing overflow errors.

  ## Solution
  Change variable types from INTEGER to BIGINT to handle large token values.

  ## Security
  - No RLS changes
  - No data loss
*/

CREATE OR REPLACE FUNCTION trigger_token_limit_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_tokens_total bigint;
  v_tokens_used bigint;
  v_percentage_used numeric;
  v_notification_type text;
  v_supabase_url text;
  v_anon_key text;
  v_recent_notification boolean;
BEGIN
  IF NEW.tokens_used = OLD.tokens_used THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE customer_id = NEW.customer_id
  AND deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE WARNING 'No user found for customer_id: %', NEW.customer_id;
    RETURN NEW;
  END IF;

  v_tokens_total := COALESCE(NEW.tokens_total, 0)::bigint;
  v_tokens_used := COALESCE(NEW.tokens_used, 0)::bigint;

  IF v_tokens_total = 0 THEN
    RETURN NEW;
  END IF;

  v_percentage_used := (v_tokens_used::numeric / v_tokens_total::numeric) * 100;

  IF v_percentage_used >= 100 THEN
    v_notification_type := '100_percent';
  ELSIF v_percentage_used >= 90 THEN
    v_notification_type := '90_percent';
  ELSIF v_percentage_used >= 75 THEN
    v_notification_type := '75_percent';
  ELSE
    RETURN NEW;
  END IF;

  SELECT check_recent_token_notification(v_user_id, v_notification_type)
  INTO v_recent_notification;

  IF v_recent_notification = true THEN
    RAISE NOTICE 'Recent notification already sent for user % (type: %), skipping', v_user_id, v_notification_type;
    RETURN NEW;
  END IF;

  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';
  END IF;

  RAISE NOTICE 'Token usage alert triggered: user=%, type=%, used=%/%, percentage=%', 
    v_user_id, v_notification_type, v_tokens_used, v_tokens_total, v_percentage_used;

  BEGIN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-tokens-limit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'user_id', v_user_id
      )
    );

    RAISE NOTICE 'Edge function called successfully for user %', v_user_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Could not call edge function: %. Recording for manual processing.', SQLERRM;

      INSERT INTO token_limit_notifications (
        user_id,
        notification_type,
        tokens_total,
        tokens_used,
        percentage_used,
        email_sent,
        email_sent_at
      ) VALUES (
        v_user_id,
        v_notification_type,
        v_tokens_total,
        v_tokens_used,
        v_percentage_used,
        false,
        NULL
      );
  END;

  RETURN NEW;
END;
$function$;
