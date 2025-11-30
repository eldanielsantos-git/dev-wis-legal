/*
  # Add pending_manual status to email_logs

  1. Changes
    - Add 'pending_manual' to the status check constraint in email_logs table
    - This status indicates email was not sent due to external service limits (e.g., Mailchimp rate limit)
    - The confirmation URL is still generated and can be used manually

  2. Security
    - No RLS changes needed
    - Only extends allowed values in constraint
*/

-- Drop existing constraint
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;

-- Add new constraint with pending_manual included
ALTER TABLE email_logs 
ADD CONSTRAINT email_logs_status_check 
CHECK (status = ANY (ARRAY['sent'::text, 'error'::text, 'success'::text, 'failed'::text, 'pending_manual'::text]));
