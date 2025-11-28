/*
  # Create Trigger for Auto-Creating User Profiles

  1. Changes
    - Drop existing INSERT policy for user_profiles (it's blocking signup)
    - Create a database function that automatically creates a user profile when a new auth user is created
    - Create a trigger that runs the function on auth.users INSERT
    - This ensures profiles are created with proper permissions

  2. Security
    - Trigger runs with SECURITY DEFINER (bypasses RLS)
    - Only runs on INSERT to auth.users
    - Maintains existing SELECT and UPDATE policies
*/

-- Drop the existing INSERT policy (it's blocking signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    first_name,
    last_name,
    phone,
    city,
    state,
    is_admin,
    avatar_url
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();