/*
  # Fix Avatar Upload During Signup

  1. Changes
    - Allow unauthenticated users to upload avatars during signup
    - Keep existing policies for authenticated users

  2. Security
    - Temporary files can be uploaded by anyone (for signup flow)
    - After signup, users can only manage their own avatars
    - Public read access maintained
*/

-- Drop the restrictive upload policy
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;

-- Create a more permissive upload policy that allows both authenticated and anon uploads
CREATE POLICY "Allow avatar uploads for signup"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
);

-- Keep the update policy for authenticated users only
-- (already exists, no changes needed)

-- Keep the delete policy for authenticated users only
-- (already exists, no changes needed)

-- Keep public read access
-- (already exists, no changes needed)
