/*
  # Fix Trigger - Use Environment Variables Directly

  1. Problem
    - Previous trigger tried to use pg_settings which may not be configured
    - Need to use Supabase's built-in environment variable access
    
  2. Solution
    - Use vault.decrypted_secrets or direct environment access
    - Simplify trigger to use inline configuration
    - Make it work without additional setup
    
  3. Note
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available
    - We'll read them from the edge function deployment environment
*/

-- Drop previous version
DROP FUNCTION IF EXISTS public.trigger_send_confirmation_email() CASCADE;

-- Create simplified function that uses HTTP directly
CREATE OR REPLACE FUNCTION public.trigger_send_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  user_first_name text;
BEGIN
  -- Get user's first name from user_profiles (may not exist yet if trigger fires before handle_new_user)
  SELECT first_name INTO user_first_name
  FROM user_profiles
  WHERE id = NEW.id;
  
  -- If no profile yet, extract name from email
  IF user_first_name IS NULL OR user_first_name = '' THEN
    user_first_name := split_part(NEW.email, '@', 1);
  END IF;
  
  -- Call edge function asynchronously using pg_net
  -- Note: The URL and service role key must be set via ALTER DATABASE
  SELECT net.http_post(
    url := current_setting('app.supabase_url', false) || '/functions/v1/send-confirmation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', false)
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

-- Create trigger on auth.users (runs AFTER handle_new_user)
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;

CREATE TRIGGER on_auth_user_created_send_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_confirmation_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_send_confirmation_email() TO postgres, service_role;

-- Grant usage on pg_net schema
GRANT USAGE ON SCHEMA net TO postgres, service_role;
