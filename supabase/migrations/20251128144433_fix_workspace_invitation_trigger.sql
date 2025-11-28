/*
  # Fix accept_workspace_invitation Trigger
  
  ## Problem:
  Trigger `accept_workspace_invitation` is failing with error:
  "record NEW has no field user_id"
  
  ## Cause:
  The trigger is referencing NEW.user_id but the table is user_profiles
  where the ID column is simply called "id", not "user_id"
  
  ## Solution:
  Change NEW.user_id to NEW.id in the trigger function
  
  ## Impact:
  - Fixes user registration errors
  - Fixes OAuth (Google/Microsoft) login errors
  - Allows workspace invitations to work correctly
*/

-- Fix the accept_workspace_invitation function
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update workspace_shares to link user_id and mark as accepted
  UPDATE workspace_shares
  SET
    shared_with_user_id = NEW.id,  -- Changed from NEW.user_id to NEW.id
    invitation_status = 'accepted',
    updated_at = now()
  WHERE shared_with_email = NEW.email
    AND invitation_status = 'pending';

  RETURN NEW;
END;
$function$;
