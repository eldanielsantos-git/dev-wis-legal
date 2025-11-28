/*
  # Cleanup duplicate workspace_shares policies

  1. Changes
    - Remove duplicate Owners policies (older versions)
    - Keep only consolidated policies
    
  2. Policies to remove
    - "Owners can view their process shares" (superseded)
    - "Owners can update their process shares" (superseded)
    - "Owners can delete their process shares" (superseded)
    - Duplicate service role policies
*/

-- Remove duplicate owner policies (superseded by "Users can..." policies)
DROP POLICY IF EXISTS "Owners can view their process shares" ON workspace_shares;
DROP POLICY IF EXISTS "Owners can update their process shares" ON workspace_shares;
DROP POLICY IF EXISTS "Owners can delete their process shares" ON workspace_shares;

-- Remove one of the duplicate service role policies
DROP POLICY IF EXISTS "Service role has full access to workspace_shares" ON workspace_shares;
