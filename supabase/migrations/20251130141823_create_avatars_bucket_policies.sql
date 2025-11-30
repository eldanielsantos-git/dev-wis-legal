/*
  # Create Avatars Bucket RLS Policies

  1. New Policies
    - Allow anyone to upload avatars (needed for signup before user is authenticated)
    - Allow authenticated users to read all avatars (public bucket)
    - Allow users to update/delete their own avatars
    - Allow service role full access

  2. Security
    - Upload restricted to image files (checked in app)
    - Users can only delete their own avatars
    - All avatars are publicly readable (bucket is public)
*/

-- Allow anyone (including anon) to upload avatars
-- This is needed for signup flow before user is authenticated
CREATE POLICY "Anyone can upload avatars"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to read all avatars
CREATE POLICY "Authenticated users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Allow public (anon) to read avatars since bucket is public
CREATE POLICY "Public can read avatars"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'avatars');

-- Allow users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service role full access
CREATE POLICY "Service role has full access to avatars"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');
