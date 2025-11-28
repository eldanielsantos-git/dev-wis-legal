/*
  # Add Trigger to Auto-Calculate tokens_total

  1. Changes
    - Create function to calculate tokens_total automatically
    - Add trigger on INSERT and UPDATE for stripe_subscriptions
    - Update existing records to recalculate tokens_total
    
  2. Purpose
    - Ensure tokens_total is always synchronized with plan_tokens + extra_tokens
    - Eliminate manual calculation errors
    
  3. Security
    - Function uses SECURITY DEFINER to bypass RLS for system operations
*/

-- Create function to calculate tokens_total
CREATE OR REPLACE FUNCTION calculate_tokens_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tokens_total := COALESCE(NEW.plan_tokens, 0) + COALESCE(NEW.extra_tokens, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-calculate tokens_total
DROP TRIGGER IF EXISTS trigger_calculate_tokens_total ON stripe_subscriptions;
CREATE TRIGGER trigger_calculate_tokens_total
  BEFORE INSERT OR UPDATE OF plan_tokens, extra_tokens
  ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_tokens_total();

-- Update existing records to recalculate tokens_total
UPDATE stripe_subscriptions
SET tokens_total = COALESCE(plan_tokens, 0) + COALESCE(extra_tokens, 0)
WHERE tokens_total != COALESCE(plan_tokens, 0) + COALESCE(extra_tokens, 0)
  OR tokens_total IS NULL;
