/*
  # Fix User Preferences Trigger - Bypass RLS

  1. Problem
    - The create_default_user_preferences() trigger fails during signup
    - RLS policy checks auth.uid() which is not available during trigger execution
    - This is blocking user creation with "Database error saving new user"

  2. Solution
    - Update function to use SECURITY DEFINER with SET search_path
    - Add error handling to prevent blocking user creation
    - Allow trigger to bypass RLS safely

  3. Security
    - Safe because trigger only runs on INSERT to auth.users (controlled by Supabase Auth)
    - Only creates preferences for the new user being created
*/

-- Drop and recreate the function with proper security context
DROP FUNCTION IF EXISTS public.create_default_user_preferences() CASCADE;

CREATE OR REPLACE FUNCTION public.create_default_user_preferences()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Criar preferências padrão para novo usuário
  INSERT INTO user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error creating user preferences for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_create_default_user_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_user_preferences();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_default_user_preferences() TO postgres, authenticated, anon, service_role;
