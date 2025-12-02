/*
  # Add process_completed to email_logs type constraint

  1. Changes
    - Add 'process_completed' to the allowed email types in email_logs table
    - This allows the system to log emails sent when a process analysis is completed

  2. Security
    - No changes to RLS policies
    - Only modifies the check constraint
*/

-- Drop the existing constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_type_check;

-- Recreate the constraint with the new type
ALTER TABLE email_logs ADD CONSTRAINT email_logs_type_check 
  CHECK (type = ANY (ARRAY[
    'confirmation'::text, 
    'password_reset'::text, 
    'status_update'::text, 
    'notification'::text,
    'process_completed'::text
  ]));
