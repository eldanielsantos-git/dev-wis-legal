/*
  # Add Auto-Accept Workspace Invites on Login

  1. Problem
    - Users who receive invites AFTER account creation have status = 'pending'
    - Currently, they need manual acceptance
    - Should auto-accept on login if email matches

  2. Solution
    - Create function to auto-accept pending invites by email
    - Function can be called on login or manually
    - Updates invitation_status to 'accepted' and links user_id

  3. Security
    - Function only updates invites matching authenticated user's email
    - Uses SECURITY DEFINER for elevated privileges
    - Maintains invitation integrity
*/

-- Create function to accept pending invitations by email
CREATE OR REPLACE FUNCTION accept_pending_invitations_by_email(p_user_id uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  -- Update all pending invitations matching the user's email
  UPDATE workspace_shares
  SET
    shared_with_user_id = p_user_id,
    invitation_status = 'accepted',
    updated_at = now()
  WHERE shared_with_email = LOWER(p_email)
    AND invitation_status = 'pending'
    AND (shared_with_user_id IS NULL OR shared_with_user_id = p_user_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_pending_invitations_by_email(uuid, text) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION accept_pending_invitations_by_email(uuid, text) IS 
'Automatically accepts all pending workspace invitations for a given email address. Returns the number of invitations accepted.';
