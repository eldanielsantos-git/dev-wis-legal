/*
  # Fix find_user_by_phone to handle country code

  1. Changes
    - Updates find_user_by_phone function to search for phone with or without country code
    - First tries exact match
    - If not found, tries with Brazil country code prefix (55)
    - Handles cases where users register with +55 prefix or without it

  2. Logic
    - Search "11958014505" will match both:
      - Phone stored as "(11) 95801-4505" (normalized: 11958014505)
      - Phone stored as "+55 (11) 95801-4505" (normalized: 5511958014505)
*/

CREATE OR REPLACE FUNCTION find_user_by_phone(search_phone text)
RETURNS TABLE (id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH normalized_search AS (
    SELECT regexp_replace(search_phone, '[^0-9]', '', 'g') as clean_phone
  )
  SELECT 
    up.id,
    up.first_name,
    up.last_name,
    up.email
  FROM user_profiles up, normalized_search ns
  WHERE 
    regexp_replace(up.phone, '[^0-9]', '', 'g') = ns.clean_phone
    OR regexp_replace(up.phone, '[^0-9]', '', 'g') = '55' || ns.clean_phone
    OR regexp_replace(up.phone, '[^0-9]', '', 'g') = substring(ns.clean_phone from 3)
  LIMIT 1;
$$;
