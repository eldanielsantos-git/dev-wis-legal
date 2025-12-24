/*
  # Add missing email types to email_logs constraint
  
  1. Problem
    - The email_logs_type_check constraint is missing several email types used in the application
    - This causes errors when edge functions try to log emails with types like 'schedule_day'
    
  2. Current allowed types (12)
    - confirmation
    - password_reset
    - status_update
    - notification
    - process_completed
    - subscription_confirmed
    - subscription_upgrade
    - subscription_downgrade
    - subscription_canceled
    - token_purchase
    - workspace_invite
    - payment_failure
    
  3. Adding missing types (8)
    - schedule_day (⚠️ causing current error)
    - admin_analysis_error
    - admin_complex_analysis_error
    - email_change
    - friend_invite
    - subscription_upgraded
    - subscription_downgraded
    - workspace_share
    
  4. Changes
    - Drop existing constraint
    - Recreate with all 20 email types
    - Maintain backward compatibility (all existing types preserved)
*/

-- Drop the existing constraint
ALTER TABLE email_logs 
DROP CONSTRAINT IF EXISTS email_logs_type_check;

-- Recreate constraint with all email types (sorted alphabetically for maintainability)
ALTER TABLE email_logs 
ADD CONSTRAINT email_logs_type_check CHECK (
  type = ANY (ARRAY[
    'admin_analysis_error'::text,
    'admin_complex_analysis_error'::text,
    'confirmation'::text,
    'email_change'::text,
    'friend_invite'::text,
    'notification'::text,
    'password_reset'::text,
    'payment_failure'::text,
    'process_completed'::text,
    'schedule_day'::text,
    'status_update'::text,
    'subscription_canceled'::text,
    'subscription_confirmed'::text,
    'subscription_downgrade'::text,
    'subscription_downgraded'::text,
    'subscription_upgrade'::text,
    'subscription_upgraded'::text,
    'token_purchase'::text,
    'workspace_invite'::text,
    'workspace_share'::text
  ])
);
