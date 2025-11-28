/*
  # Fix Google OAuth Name Extraction in User Profiles

  1. Problem
    - Google OAuth returns only `full_name` or `name` field, not separate `first_name` and `last_name`
    - Current trigger only checks for `first_name` and `last_name` in raw_user_meta_data
    - This causes Google OAuth users to have empty name fields in user_profiles

  2. Solution
    - Update `handle_new_user()` function to extract names from Google OAuth properly
    - Try multiple field names: `first_name`/`last_name` (email signup), `full_name`, `name`, `display_name` (OAuth)
    - Split full name into first and last name intelligently
    - Use first word as first_name, remaining words as last_name
    - If only one word, use it as first_name and leave last_name empty
    - Check both `avatar_url` and `picture` fields for profile images

  3. Data Migration
    - Update existing user profiles that have empty first_name/last_name
    - Extract names from auth.users raw_user_meta_data
    - Apply same parsing logic to existing records

  4. Examples
    - "João Pedro Raupp" → first_name: "João", last_name: "Pedro Raupp"
    - "Daniel Santos" → first_name: "Daniel", last_name: "Santos"
    - "Twan" → first_name: "Twan", last_name: "" (empty)
*/

-- Drop and recreate the function with improved name extraction logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_avatar_url text;
BEGIN
  -- Try to get first_name and last_name directly (for email/password signup)
  v_first_name := NEW.raw_user_meta_data->>'first_name';
  v_last_name := NEW.raw_user_meta_data->>'last_name';

  -- If not found, try to extract from full_name or name (for OAuth providers like Google)
  IF v_first_name IS NULL OR v_first_name = '' THEN
    -- Try multiple possible field names for full name
    v_full_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      ''
    );

    -- If we have a full name, split it intelligently
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      -- Remove extra whitespace and trim
      v_full_name := TRIM(regexp_replace(v_full_name, '\s+', ' ', 'g'));

      -- Check if there are multiple words
      IF position(' ' IN v_full_name) > 0 THEN
        -- Split: first word = first_name, rest = last_name
        v_first_name := split_part(v_full_name, ' ', 1);
        v_last_name := TRIM(substring(v_full_name from position(' ' in v_full_name) + 1));
      ELSE
        -- Single word: use as first_name only
        v_first_name := v_full_name;
        v_last_name := '';
      END IF;
    ELSE
      -- No name found at all, use empty strings
      v_first_name := '';
      v_last_name := '';
    END IF;
  END IF;

  -- Get avatar URL from multiple possible fields
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  -- Insert the user profile
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
    COALESCE(v_first_name, ''),
    COALESCE(v_last_name, ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    false,
    v_avatar_url
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger already exists, no need to recreate it
-- It will automatically use the updated function

/*
  # Update existing user profiles with empty names

  This section updates all existing user profiles that have empty or null
  first_name and last_name fields, extracting the data from auth.users
*/

DO $$
DECLARE
  v_user_record RECORD;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_avatar_url text;
  v_updated_count integer := 0;
BEGIN
  -- Find all user profiles with empty first_name or last_name
  FOR v_user_record IN
    SELECT up.id, au.raw_user_meta_data
    FROM public.user_profiles up
    INNER JOIN auth.users au ON up.id = au.id
    WHERE (up.first_name IS NULL OR up.first_name = '' OR up.first_name = 'EMPTY')
       OR (up.last_name IS NULL OR up.last_name = '' OR up.last_name = 'EMPTY')
  LOOP
    -- Try to get first_name and last_name directly
    v_first_name := v_user_record.raw_user_meta_data->>'first_name';
    v_last_name := v_user_record.raw_user_meta_data->>'last_name';

    -- If not found, try to extract from full_name or name
    IF v_first_name IS NULL OR v_first_name = '' THEN
      v_full_name := COALESCE(
        v_user_record.raw_user_meta_data->>'full_name',
        v_user_record.raw_user_meta_data->>'name',
        v_user_record.raw_user_meta_data->>'display_name',
        ''
      );

      IF v_full_name IS NOT NULL AND v_full_name != '' THEN
        -- Remove extra whitespace and trim
        v_full_name := TRIM(regexp_replace(v_full_name, '\s+', ' ', 'g'));

        -- Check if there are multiple words
        IF position(' ' IN v_full_name) > 0 THEN
          -- Split: first word = first_name, rest = last_name
          v_first_name := split_part(v_full_name, ' ', 1);
          v_last_name := TRIM(substring(v_full_name from position(' ' in v_full_name) + 1));
        ELSE
          -- Single word: use as first_name only
          v_first_name := v_full_name;
          v_last_name := '';
        END IF;
      ELSE
        v_first_name := '';
        v_last_name := '';
      END IF;
    END IF;

    -- Get avatar URL if current one is empty
    v_avatar_url := COALESCE(
      v_user_record.raw_user_meta_data->>'avatar_url',
      v_user_record.raw_user_meta_data->>'picture'
    );

    -- Update the user profile
    UPDATE public.user_profiles
    SET
      first_name = COALESCE(v_first_name, ''),
      last_name = COALESCE(v_last_name, ''),
      avatar_url = COALESCE(v_avatar_url, avatar_url),
      updated_at = now()
    WHERE id = v_user_record.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Log the number of updated records
  RAISE NOTICE 'Updated % user profiles with extracted names from OAuth data', v_updated_count;
END $$;
