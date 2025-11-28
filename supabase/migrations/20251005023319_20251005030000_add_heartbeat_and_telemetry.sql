/*
  # Add Heartbeat, Telemetry and Debug Logging

  1. New Fields in processos table
    - `finalization_lock_heartbeat` (timestamp) - Last heartbeat from active finalization
    - `retry_metadata` (jsonb) - Metadata about retry attempts
    - `consolidation_attempts` (integer) - Number of consolidation attempts
    - `last_error_type` (text) - Type of last error encountered

  2. New Table: consolidation_debug_logs
    - Stores raw responses from Gemini when JSON parse fails
    - Enables debugging and analysis of consolidation failures

  3. Indexes
    - Index on finalization_lock_heartbeat for faster lock queries
    - Index on last_error_type for error analysis
*/

-- Add new fields to processos table
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS finalization_lock_heartbeat timestamptz,
ADD COLUMN IF NOT EXISTS retry_metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS consolidation_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_type text;

-- Create consolidation_debug_logs table
CREATE TABLE IF NOT EXISTS consolidation_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL,
  raw_response text NOT NULL,
  error_message text NOT NULL,
  response_length integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_processos_lock_heartbeat
  ON processos(finalization_lock_heartbeat)
  WHERE finalization_lock_heartbeat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processos_last_error
  ON processos(last_error_type)
  WHERE last_error_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consolidation_logs_processo
  ON consolidation_debug_logs(processo_id, created_at DESC);

-- Enable RLS on consolidation_debug_logs
ALTER TABLE consolidation_debug_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for consolidation_debug_logs
CREATE POLICY "Service role can read consolidation logs"
  ON consolidation_debug_logs FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can insert consolidation logs"
  ON consolidation_debug_logs FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Add comment for documentation
COMMENT ON COLUMN processos.finalization_lock_heartbeat IS
  'Timestamp of last heartbeat from active finalization process. Used to detect stale locks.';

COMMENT ON COLUMN processos.retry_metadata IS
  'Metadata about retry attempts including counts, timestamps, and error types.';

COMMENT ON TABLE consolidation_debug_logs IS
  'Stores raw Gemini responses when JSON parsing fails during consolidation for debugging purposes.';