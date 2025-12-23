/*
  # Create process deadlines system
  
  1. New Tables
    - `process_deadlines`
      - `id` (uuid, primary key)
      - `processo_id` (uuid, foreign key to processos)
      - `user_id` (uuid, foreign key to auth.users)
      - `deadline_date` (date) - The deadline date
      - `deadline_time` (time) - Optional specific time
      - `subject` (text) - Description of the deadline
      - `category` (text) - Optional category (Audiência, Recurso, etc)
      - `party_type` (text) - Who the deadline applies to
      - `source_type` (text) - Whether auto-extracted or manual
      - `analysis_result_id` (uuid) - Link to analysis if auto-extracted
      - `status` (text) - pending, completed, or expired
      - `notes` (text) - Optional user notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Indexes
    - Index on (user_id, deadline_date) for fast queries
    - Index on processo_id
    - Index on status
  
  3. Security
    - Enable RLS on process_deadlines table
    - Users can only view their own deadlines
    - Users can create/update/delete their own deadlines
  
  4. Triggers
    - Auto-update updated_at timestamp
*/

-- Create process_deadlines table
CREATE TABLE IF NOT EXISTS process_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deadline_date date NOT NULL,
  deadline_time time,
  subject text NOT NULL,
  category text,
  party_type text NOT NULL DEFAULT 'both',
  source_type text NOT NULL DEFAULT 'manual',
  analysis_result_id uuid REFERENCES analysis_results(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_party_type CHECK (party_type IN ('accusation', 'defendant', 'both')),
  CONSTRAINT valid_source_type CHECK (source_type IN ('auto', 'manual')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_process_deadlines_user_date 
  ON process_deadlines(user_id, deadline_date);
  
CREATE INDEX IF NOT EXISTS idx_process_deadlines_processo 
  ON process_deadlines(processo_id);
  
CREATE INDEX IF NOT EXISTS idx_process_deadlines_status 
  ON process_deadlines(status);

-- Enable RLS
ALTER TABLE process_deadlines ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: users can view their own deadlines
CREATE POLICY "Users can view own deadlines"
  ON process_deadlines
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for INSERT: users can create their own deadlines
CREATE POLICY "Users can create own deadlines"
  ON process_deadlines
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: users can update their own deadlines
CREATE POLICY "Users can update own deadlines"
  ON process_deadlines
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for DELETE: users can delete their own deadlines
CREATE POLICY "Users can delete own deadlines"
  ON process_deadlines
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_process_deadlines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_deadlines_updated_at
  BEFORE UPDATE ON process_deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_process_deadlines_updated_at();

-- Function to update expired deadlines automatically
CREATE OR REPLACE FUNCTION update_expired_deadlines()
RETURNS void AS $$
BEGIN
  UPDATE process_deadlines
  SET status = 'expired'
  WHERE status = 'pending'
    AND deadline_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;