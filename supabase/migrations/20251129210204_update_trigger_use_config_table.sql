/*
  # Update Trigger to Use System Config Table

  1. Changes
    - Read configuration from system_config table instead of pg_settings
    - More reliable and doesn't require database-level permissions
    
  2. Security
    - Function runs as SECURITY DEFINER so it can read system_config
    - Only triggered on new user creation
*/

-- Drop and recreate the trigger function
DROP FUNCTION IF EXISTS public.trigger_send_confirmation_email() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_send_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  user_first_name text;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Read configuration from system_config table
  SELECT value INTO supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO service_role_key FROM system_config WHERE key = 'service_role_key';
  
  -- Get user's first name from user_profiles
  SELECT first_name INTO user_first_name
  FROM user_profiles
  WHERE id = NEW.id;
  
  -- If no profile yet, extract name from email
  IF user_first_name IS NULL OR user_first_name = '' THEN
    user_first_name := split_part(NEW.email, '@', 1);
  END IF;
  
  -- Call edge function asynchronously using pg_net
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-confirmation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.id,
      'email', NEW.email,
      'first_name', user_first_name
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;
  
  RAISE LOG 'Confirmation email trigger fired for user %, request_id: %', NEW.email, request_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in trigger_send_confirmation_email for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;

CREATE TRIGGER on_auth_user_created_send_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_confirmation_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_send_confirmation_email() TO postgres, service_role;
GRANT USAGE ON SCHEMA net TO postgres, service_role;
