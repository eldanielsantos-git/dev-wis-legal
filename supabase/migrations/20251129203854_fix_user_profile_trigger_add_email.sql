/*
  # Fix User Profile Trigger - Add Email Field

  1. Problem
    - The handle_new_user() function is not inserting the email field
    - This causes "Database error saving new user" on signup
    - Email is required for various features like workspace invitations

  2. Solution
    - Update handle_new_user() to include email from auth.users
    - Email comes from NEW.email (not from raw_user_meta_data)

  3. Security
    - Maintains existing SECURITY DEFINER behavior
    - No RLS changes needed
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
