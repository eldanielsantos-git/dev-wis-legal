/*
  # Fix OAuth Avatar Extraction

  1. Problem
    - Google and Microsoft OAuth may return avatar/picture in different fields
    - Google: `picture`, `avatar_url`
    - Microsoft: requires User.Read scope and may return photo data differently
    - Current trigger only checks `avatar_url`

  2. Solution
    - Update handle_new_user() function to check multiple possible fields:
      - `avatar_url` (standard)
      - `picture` (Google)
      - `avatar` (alternative)
    - Try fields in order until one is found

  3. Security
    - No RLS changes (maintains existing SECURITY DEFINER behavior)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_name_parts TEXT[];
  v_avatar_url TEXT;
BEGIN
  -- Try to get first_name and last_name directly (Google format)
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';
  
  -- If not available, try to extract from full_name (Microsoft format)
  IF (v_first_name IS NULL OR v_first_name = '') AND (v_last_name IS NULL OR v_last_name = '') THEN
    v_full_name := NEW.raw_user_meta_data->>'full_name';
    
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      -- Split full_name by space
      v_name_parts := string_to_array(trim(v_full_name), ' ');
      
      IF array_length(v_name_parts, 1) >= 2 THEN
        -- First part is first_name, rest is last_name
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
      ELSIF array_length(v_name_parts, 1) = 1 THEN
        -- Only one name provided
        v_first_name := v_name_parts[1];
        v_last_name := '';
      END IF;
    END IF;
  END IF;

  -- Try to get avatar_url from multiple possible fields
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar'
  );

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
    avatar_url,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(v_first_name, ''),
    COALESCE(v_last_name, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'phone_country_code', '+55'),
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    v_avatar_url,
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
