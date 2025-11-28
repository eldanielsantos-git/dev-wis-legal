/*
  # Add Audio Support to Chat Messages

  1. New Storage Bucket
    - Create 'chat-audios' bucket for storing audio recordings
    - Set appropriate RLS policies for secure access
  
  2. Schema Changes
    - Add `audio_url` column to `chat_messages` table
    - Add `audio_duration` column to store audio length in seconds
    - Add `is_audio` boolean flag to identify audio messages
  
  3. Security
    - Enable RLS on chat-audios bucket
    - Users can upload their own audio files
    - Users can access audio from their own messages
*/

-- Create storage bucket for chat audios
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audios', 'chat-audios', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Allow authenticated users to upload their own audio files
CREATE POLICY "Users can upload their own audio files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-audios' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own audio files
CREATE POLICY "Users can read their own audio files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-audios' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete their own audio files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-audios' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add audio-related columns to chat_messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN audio_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'audio_duration'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN audio_duration integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'is_audio'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN is_audio boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster audio message queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_audio 
ON chat_messages(is_audio) WHERE is_audio = true;
