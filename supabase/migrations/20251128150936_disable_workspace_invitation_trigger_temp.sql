/*
  # Disable accept_workspace_invitation Trigger Temporarily
  
  ## Problem:
  Users cannot sign up with error "Database error saving new user"
  Even though the trigger was fixed, the error persists
  
  ## Solution:
  Temporarily disable the trigger to test if it's causing the issue
  This is a diagnostic step - we'll re-enable it after testing
  
  ## Impact:
  - Users will be able to sign up
  - Workspace invitations won't auto-accept until re-enabled
  - This is temporary for testing only
*/

-- Disable the trigger temporarily
ALTER TABLE public.user_profiles
  DISABLE TRIGGER trigger_accept_workspace_invitation;

-- Add a comment to remind us to re-enable
COMMENT ON TRIGGER trigger_accept_workspace_invitation ON public.user_profiles IS
  'TEMPORARILY DISABLED for testing - RE-ENABLE after signup works';
