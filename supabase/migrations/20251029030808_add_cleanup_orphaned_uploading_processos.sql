/*
  # Add cleanup for orphaned uploading processos

  1. New Function
    - `cleanup_orphaned_uploading_processos()` - Removes processos stuck in 'uploading' state for more than 1 hour

  2. Purpose
    - If upload fails or user closes browser during upload, the processo record stays in 'uploading' forever
    - This function automatically cleans up these orphaned records
    - Can be called manually or via cron job

  3. Safety
    - Only deletes processos in 'uploading' state
    - Only deletes if older than 1 hour (prevents deleting active uploads)
    - Cascading deletes will clean up related records
*/

CREATE OR REPLACE FUNCTION cleanup_orphaned_uploading_processos()
RETURNS TABLE(deleted_count integer) AS $$
DECLARE
  count integer;
BEGIN
  DELETE FROM processos
  WHERE status = 'uploading'
    AND created_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS count = ROW_COUNT;
  
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION cleanup_orphaned_uploading_processos() TO authenticated, service_role;
