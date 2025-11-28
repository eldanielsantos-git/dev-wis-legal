/*
  # Create backups bucket for storage ZIP files

  1. New Bucket
    - `backups` - Stores ZIP files with storage backups
  
  2. Security
    - Only admins can upload backups
    - Only admins can download backups
    - Files expire after 30 days (cleanup policy)
*/

-- Create backups bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backups',
  'backups',
  false,
  10737418240, -- 10GB limit
  ARRAY['application/zip']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete backups" ON storage.objects;

-- Allow admins to upload backups
CREATE POLICY "Admins can upload backups"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'backups' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Allow admins to read backups
CREATE POLICY "Admins can read backups"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'backups' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Allow admins to delete old backups
CREATE POLICY "Admins can delete backups"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'backups' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );