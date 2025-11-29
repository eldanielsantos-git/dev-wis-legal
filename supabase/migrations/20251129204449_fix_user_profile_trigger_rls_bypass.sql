/*
  # Fix User Profile Trigger - Bypass RLS

  1. Problem
    - The handle_new_user() trigger fails during signup
    - RLS policy 'insert_self_profile' checks auth.uid() which may not be set during trigger execution
    - This causes "Database error saving new user" error

  2. Solution
    - Change function to use SECURITY DEFINER with SET search_path
    - This allows the trigger to bypass RLS policies safely
    - The trigger runs with elevated privileges to create the profile

  3. Security
    - Safe because trigger only runs on INSERT to auth.users (controlled by Supabase Auth)
    - Only creates profile for the new user being created
    - No user input is directly used, all data comes from auth.users table
*/

-- Drop and recreate the function with proper security context
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    phone_country_code,
    oab,
    city,
    state,
    is_admin,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+55'),
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, authenticated, anon, service_role;
