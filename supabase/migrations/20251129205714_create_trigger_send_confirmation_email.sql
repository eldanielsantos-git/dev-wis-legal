/*
  # Create Trigger to Send Confirmation Email

  1. Purpose
    - Automatically send confirmation email when a new user is created
    - Uses Supabase Edge Function via pg_net extension
    
  2. Implementation
    - Creates a function that calls the edge function
    - Creates a trigger on auth.users INSERT
    - Uses service role key for authorization
    
  3. Security
    - Trigger only fires on new user creation
    - Uses secure service role authentication
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send confirmation email via edge function
CREATE OR REPLACE FUNCTION public.trigger_send_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  service_role_key text;
  supabase_url text;
  user_first_name text;
BEGIN
  -- Get configuration from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Get user's first name from user_profiles
  SELECT first_name INTO user_first_name
  FROM user_profiles
  WHERE id = NEW.id;
  
  -- If no profile yet, use email as name
  IF user_first_name IS NULL THEN
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
    )
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

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;

CREATE TRIGGER on_auth_user_created_send_email
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_confirmation_email();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_send_confirmation_email() TO postgres, service_role;
