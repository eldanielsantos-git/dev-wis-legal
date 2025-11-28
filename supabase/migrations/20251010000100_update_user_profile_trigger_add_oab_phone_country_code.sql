/*
  # Update User Profile Trigger to Include OAB and Phone Country Code

  1. Changes
    - Update handle_new_user() function to extract and insert oab and phone_country_code fields
    - These fields come from the auth.users raw_user_meta_data during signup

  2. Security
    - No RLS changes (maintains existing SECURITY DEFINER behavior)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
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