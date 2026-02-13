/*
  # Create function to find user by phone with normalization

  1. New Functions
    - `find_user_by_phone(search_phone text)` - Finds user by phone number
      - Removes all formatting characters from both search input and stored phone
      - Compares normalized versions for matching
      - Returns user id, first_name, last_name, email

  2. Purpose
    - Allows WIS API to find users regardless of how their phone is formatted in the database
    - Phone stored as "(11) 98755-6013" will match search for "11987556013"
*/

CREATE OR REPLACE FUNCTION find_user_by_phone(search_phone text)
RETURNS TABLE (id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    up.id,
    up.first_name,
    up.last_name,
    up.email
  FROM user_profiles up
  WHERE regexp_replace(up.phone, '[^0-9]', '', 'g') = regexp_replace(search_phone, '[^0-9]', '', 'g')
  LIMIT 1;
$$;