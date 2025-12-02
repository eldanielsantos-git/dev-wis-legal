/*
  # Add subscription and token email types to email_logs

  1. Changes
    - Add 'subscription_confirmed' to log subscription confirmation emails
    - Add 'subscription_upgrade' to log subscription upgrade emails
    - Add 'subscription_downgrade' to log subscription downgrade emails
    - Add 'subscription_canceled' to log subscription cancellation emails
    - Add 'token_purchase' to log token package purchase emails

  2. Security
    - No changes to RLS policies
    - Only modifies the check constraint
*/

-- Drop the existing constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_type_check;

-- Recreate the constraint with all email types
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
    'token_purchase'::text
  ]));
