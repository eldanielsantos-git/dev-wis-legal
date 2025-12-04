/*
  # Add payment_failure email type to email_logs

  1. Changes
    - Add 'payment_failure' to log payment failure notification emails
    - This type is used when payment attempts fail (card declined, insufficient funds, etc.)

  2. Security
    - No changes to RLS policies
    - Only modifies the check constraint
*/

-- Drop the existing constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_type_check;

-- Recreate the constraint with all email types including payment_failure
ALTER TABLE email_logs ADD CONSTRAINT email_logs_type_check
  CHECK (type = ANY (ARRAY[
    'confirmation'::text,
    'password_reset'::text,
    'status_update'::text,
    'notification'::text,
    'process_completed'::text,
    'subscription_confirmed'::text,
    'subscription_upgrade'::text,
    'subscription_downgrade'::text,
    'subscription_canceled'::text,
    'token_purchase'::text,
    'workspace_invite'::text,
    'payment_failure'::text
  ]));