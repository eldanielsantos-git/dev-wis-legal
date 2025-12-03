/*
  # Remove unique constraint on processo_id and shared_with_email

  Remove the unique constraint that prevents multiple invitations to the same email for the same process.
  This allows unlimited sharing invitations to encourage platform adoption.
*/

-- Drop the unique constraint
ALTER TABLE workspace_shares 
DROP CONSTRAINT IF EXISTS unique_processo_email;
