/*
  # Fix find_user_by_phone to prioritize users with active subscriptions

  1. Changes
    - Updates find_user_by_phone function to prioritize users with active subscriptions
    - First tries to find users with matching phone (with or without country code)
    - Orders by subscription status (active first) then by user creation date
    - Returns the most likely correct user

  2. Logic
    - Search "11958014505" will match both:
      - Phone stored as "(11) 95801-4505" (normalized: 11958014505)
      - Phone stored as "+55 (11) 95801-4505" (normalized: 5511958014505)
    - Prioritizes users with active subscriptions over those without
*/

CREATE OR REPLACE FUNCTION find_user_by_phone(search_phone text)
RETURNS TABLE (id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH normalized_search AS (
    SELECT regexp_replace(search_phone, '[^0-9]', '', 'g') as clean_phone
  ),
  matching_users AS (
    SELECT 
      up.id,
      up.first_name,
      up.last_name,
      up.email,
      up.created_at,
      COALESCE(ss.status::text, 'none') as subscription_status
    FROM user_profiles up
    CROSS JOIN normalized_search ns
    LEFT JOIN stripe_customers sc ON sc.user_id = up.id
    LEFT JOIN stripe_subscriptions ss ON ss.customer_id = sc.customer_id
    WHERE 
      regexp_replace(up.phone, '[^0-9]', '', 'g') = ns.clean_phone
      OR regexp_replace(up.phone, '[^0-9]', '', 'g') = '55' || ns.clean_phone
      OR regexp_replace(up.phone, '[^0-9]', '', 'g') = substring(ns.clean_phone from 3)
  )
  SELECT 
    id,
    first_name,
    last_name,
    email
  FROM matching_users
  ORDER BY 
    CASE 
      WHEN subscription_status = 'active' THEN 1
      WHEN subscription_status = 'trialing' THEN 2
      WHEN subscription_status = 'not_started' THEN 3
      ELSE 4
    END,
    created_at DESC
  LIMIT 1;
$$;
