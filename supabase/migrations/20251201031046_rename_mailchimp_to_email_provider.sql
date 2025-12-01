/*
  # Rename mailchimp_response to email_provider_response
  
  1. Changes
    - Rename column `mailchimp_response` to `email_provider_response` in `email_logs` table
    - Update table comment to reflect generic email provider
  
  2. Notes
    - Safe operation using IF EXISTS checks
    - Preserves existing data
*/

-- Rename column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'mailchimp_response'
  ) THEN
    ALTER TABLE email_logs RENAME COLUMN mailchimp_response TO email_provider_response;
  END IF;
END $$;

-- Update table comment
COMMENT ON TABLE email_logs IS 'Logs of all emails sent through the system via email providers (Resend, etc)';
