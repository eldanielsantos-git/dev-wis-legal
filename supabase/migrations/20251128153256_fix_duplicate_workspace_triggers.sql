/*
  # Fix Duplicate Workspace Invitation Triggers
  
  ## Problem Found:
  We have 2 triggers doing the SAME thing:
  1. match_user_workspace_shares on auth.users (AFTER INSERT)
  2. trigger_accept_workspace_invitation on user_profiles (AFTER INSERT)
  
  Both try to UPDATE workspace_shares with the user_id
  
  ## Issue:
  - The auth.users trigger runs FIRST (before profile is created)
  - It tries to set shared_with_user_id = NEW.id
  - But there's a FOREIGN KEY constraint: workspace_shares.shared_with_user_id → user_profiles.id
  - The profile doesn't exist yet, so FK constraint fails!
  - Result: "Database error saving new user"
  
  ## Solution:
  Disable the trigger on auth.users and keep only the one on user_profiles
  Because by the time user_profiles INSERT happens, the auth.users record is committed
  
  ## Impact:
  - Users can sign up successfully
  - Workspace invitations still auto-accept (via user_profiles trigger)
  - No more FK constraint violations
*/

-- Disable the duplicate trigger on auth.users
DROP TRIGGER IF EXISTS match_user_workspace_shares ON auth.users;

-- Add comment explaining why it was removed
COMMENT ON FUNCTION public.match_workspace_share_user_id() IS
  'DEPRECATED: This function was causing FK constraint errors because it ran before user_profiles was created. Use trigger_accept_workspace_invitation on user_profiles instead.';

-- Ensure the user_profiles trigger is enabled and working
-- (We already fixed this in previous migration with error handling)

-- Verify: Show remaining triggers on auth.users
-- SELECT tgname FROM pg_trigger t
-- JOIN pg_class c ON t.tgrelid = c.oid
-- JOIN pg_namespace n ON c.relnamespace = n.oid
-- WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;
