/*
  # Fix Microsoft Auth Name Extraction

  1. Problem
    - Microsoft Auth returns `full_name` field (e.g., "Daniel Santos")
    - Current trigger only extracts `first_name` and `last_name` separately
    - This works for Google but not for Microsoft/Azure

  2. Solution
    - Update handle_new_user() function to handle both formats:
      - If `first_name` and `last_name` exist, use them (Google)
      - If only `full_name` exists, split it (Microsoft/Azure)
    - Update existing user profile for eldanielsantos@outlook.com

  3. Security
    - No RLS changes (maintains existing SECURITY DEFINER behavior)
*/

-- Update the trigger function to handle both Google and Microsoft auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_name_parts TEXT[];
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
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing Microsoft auth user
UPDATE user_profiles
SET 
  first_name = 'Daniel',
  last_name = 'Santos'
WHERE email = 'eldanielsantos@outlook.com'
  AND (first_name IS NULL OR first_name = '')
  AND (last_name IS NULL OR last_name = '');
