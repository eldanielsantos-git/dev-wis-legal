/*
  # Fix Paginas RLS Policies for Authenticated Users

  1. Problem
    - Users may not be able to access paginas through processo relationship
    - Need explicit policy for authenticated users

  2. Changes
    - Add specific policy for authenticated users to read paginas
    - Keep existing public policy as fallback
    - Ensure service role maintains full access

  3. Security
    - Authenticated users can read all paginas (they already have access control through processos table)
    - Service role maintains insert/update capabilities
*/

-- Drop policy if exists and recreate
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read pages" ON paginas;
END $$;

-- Add explicit policy for authenticated users to read paginas
CREATE POLICY "Authenticated users can read pages"
  ON paginas
  FOR SELECT
  TO authenticated
  USING (true);