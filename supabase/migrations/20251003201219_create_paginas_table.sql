/*
  # Create paginas table for storing transcribed text by page

  1. New Tables
    - `paginas`
      - `id` (uuid, primary key, auto-generated)
      - `processo_id` (uuid, foreign key to processos)
      - `page_number` (integer, page number)
      - `text` (text, transcribed text for this page)
      - `created_at` (timestamptz, auto-generated)

  2. Security
    - Enable RLS on `paginas` table
    - Add policy for authenticated users to read all pages
    - Add policy for service role to insert/update pages

  3. Indexes
    - Create index on processo_id for faster lookups
    - Create unique index on (processo_id, page_number) to prevent duplicates
*/

-- Create paginas table
CREATE TABLE IF NOT EXISTS paginas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  page_number integer NOT NULL CHECK (page_number > 0),
  text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (processo_id, page_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_paginas_processo_id ON paginas(processo_id);
CREATE INDEX IF NOT EXISTS idx_paginas_page_number ON paginas(page_number);

-- Enable RLS
ALTER TABLE paginas ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read pages (for now, can be restricted later)
CREATE POLICY "Anyone can read pages"
  ON paginas
  FOR SELECT
  TO public
  USING (true);

-- Policy: Service role can insert pages
CREATE POLICY "Service role can insert pages"
  ON paginas
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Service role can update pages
CREATE POLICY "Service role can update pages"
  ON paginas
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
