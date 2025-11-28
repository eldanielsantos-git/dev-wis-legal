/*
  # Fix tokens_total Trigger to Always Calculate

  1. Changes
    - Drop existing trigger
    - Recreate trigger to fire on ANY UPDATE or INSERT
    - Ensure tokens_total is ALWAYS synchronized
    
  2. Purpose
    - Fix issue where tokens_total wasn't being recalculated on all updates
    - Ensure frontend always shows correct token values
    
  3. Security
    - Function uses SECURITY DEFINER to bypass RLS
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_calculate_tokens_total ON stripe_subscriptions;

-- Recreate trigger to fire on ALL inserts and updates (not just specific columns)
CREATE TRIGGER trigger_calculate_tokens_total
  BEFORE INSERT OR UPDATE
  ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tokens_total();

-- Force recalculation on all existing records
UPDATE stripe_subscriptions
SET extra_tokens = COALESCE(extra_tokens, 0)
WHERE deleted_at IS NULL;
