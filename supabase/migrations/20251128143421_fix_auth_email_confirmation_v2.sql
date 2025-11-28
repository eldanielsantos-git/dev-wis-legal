/*
  # Fix AUTH Email Confirmation Issues V2
  
  ## Problem Identified:
  1. Email confirmation is ENABLED in Supabase Dashboard
  2. Users trying to sign up get "User already registered" error
  3. OAuth (Google/Microsoft) fails if email already exists
  4. Password recovery says "not allowed"
  5. Email sending was working but now stopped
  
  ## Root Cause:
  When email confirmation is ENABLED:
  - Users MUST confirm email before login
  - If user tries to sign up again, they get "already exists" error
  - OAuth fails because it tries to create user with existing email
  - Password recovery fails for unconfirmed users
  
  ## Solution:
  1. Auto-confirm all existing users
  2. Ensure trigger doesn't fail on duplicate inserts
  3. Update handle_new_user to be idempotent
  
  ## Security:
  - Maintains RLS policies
  - Preserves user data integrity
  - Safe for production
*/

-- Step 1: Auto-confirm all existing users who haven't confirmed their email
-- Note: confirmed_at is a generated column, so we only update email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, created_at)
WHERE email_confirmed_at IS NULL;

-- Step 2: Update handle_new_user function to be idempotent (avoid duplicate errors)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_name_parts TEXT[];
  v_avatar_url TEXT;
  v_profile_exists BOOLEAN;
BEGIN
  -- Check if profile already exists
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) INTO v_profile_exists;

  -- If profile already exists, skip creation
  IF v_profile_exists THEN
    RAISE NOTICE 'Profile already exists for user %, skipping creation', NEW.id;
    RETURN NEW;
  END IF;

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

  -- Insert user profile with ON CONFLICT to handle race conditions
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
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

-- Step 3: Ensure users without profiles get them created
INSERT INTO public.user_profiles (
  id,
  first_name,
  last_name,
  phone,
  phone_country_code,
  is_admin,
  email
)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  u.raw_user_meta_data->>'phone',
  COALESCE(u.raw_user_meta_data->>'phone_country_code', '+55'),
  false,
  u.email
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
