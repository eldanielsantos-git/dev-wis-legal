/*
  # Fix Workspace Invitation Trigger - Safe Version
  
  ## Problem:
  The trigger tries to UPDATE workspace_shares during user_profiles INSERT
  This can cause FK constraint violations or timing issues because:
  - The user profile isn't fully committed yet
  - Foreign key checks happen immediately
  - Can cause deadlocks in concurrent scenarios
  
  ## Solution:
  Make the trigger safe by:
  1. Using DEFERRED constraint checking (if possible)
  2. Adding error handling
  3. Making it truly idempotent
  4. Not failing if update doesn't work
  
  ## Impact:
  - Users can sign up without errors
  - Workspace invitations will still auto-accept
  - More resilient to timing issues
*/

-- Create safer version of accept_workspace_invitation
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Try to update workspace_shares, but don't fail if it doesn't work
  -- This prevents the entire user signup from failing
  BEGIN
    UPDATE workspace_shares
    SET
      shared_with_user_id = NEW.id,
      invitation_status = 'accepted',
      accepted_at = now(),
      updated_at = now()
    WHERE shared_with_email = NEW.email
      AND invitation_status = 'pending'
      AND shared_with_user_id IS NULL;  -- Only update if not already set
    
    -- Log success (optional, for debugging)
    IF FOUND THEN
      RAISE NOTICE 'Workspace invitation auto-accepted for user %', NEW.id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the trigger
      RAISE WARNING 'Failed to auto-accept workspace invitation for %: %', NEW.email, SQLERRM;
      -- Continue anyway - user signup should succeed
  END;
  
  RETURN NEW;
END;
$function$;

-- Re-enable the trigger
ALTER TABLE public.user_profiles
  ENABLE TRIGGER trigger_accept_workspace_invitation;

-- Update comment
COMMENT ON TRIGGER trigger_accept_workspace_invitation ON public.user_profiles IS
  'Auto-accepts workspace invitations when user signs up. Now with error handling to prevent signup failures.';
