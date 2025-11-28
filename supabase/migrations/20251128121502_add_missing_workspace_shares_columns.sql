/*
  # Add missing columns to workspace_shares table

  1. Changes
    - Add `shared_with_name` column (user's name)
    - Add `permission_level` column ('read_only' or 'editor')
    - Add `updated_at` column with auto-update trigger
    
  2. Notes
    - These columns were in the original design but missing from actual table
    - Maintains backward compatibility with default values
*/

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add shared_with_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_shares' AND column_name = 'shared_with_name'
  ) THEN
    ALTER TABLE workspace_shares ADD COLUMN shared_with_name text NOT NULL DEFAULT '';
  END IF;

  -- Add permission_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_shares' AND column_name = 'permission_level'
  ) THEN
    ALTER TABLE workspace_shares ADD COLUMN permission_level text NOT NULL DEFAULT 'read_only' 
      CHECK (permission_level IN ('read_only', 'editor'));
  END IF;

  -- Add updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_shares' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE workspace_shares ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_workspace_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_workspace_shares_updated_at ON workspace_shares;
CREATE TRIGGER trigger_update_workspace_shares_updated_at
  BEFORE UPDATE ON workspace_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_shares_updated_at();
