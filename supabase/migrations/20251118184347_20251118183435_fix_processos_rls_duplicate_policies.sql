/*
  # Fix processos RLS policies with helper function

  1. Changes
    - Create a helper function to check if user is admin
    - Update RLS policies to use the helper function
    - Avoid recursive queries that can cause performance issues

  2. Security
    - Maintains admin access to all processos
    - Maintains user access to own processos
    - Improves query performance
*/

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Drop all existing policies on processos
DROP POLICY IF EXISTS "Service role has full access" ON processos;
DROP POLICY IF EXISTS "Users can view own processos or admins can view any" ON processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON processos;
DROP POLICY IF EXISTS "Users can update own processos or admins can update any" ON processos;
DROP POLICY IF EXISTS "Users can delete own processos or admins can delete any" ON processos;

-- Recreate policies using the helper function
CREATE POLICY "Allow service role full access"
  ON processos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow users to view own processos or admins to view all"
  ON processos
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    public.is_admin_user()
  );

CREATE POLICY "Allow users to insert own processos"
  ON processos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own processos or admins to update all"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    public.is_admin_user()
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    public.is_admin_user()
  );

CREATE POLICY "Allow users to delete own processos or admins to delete all"
  ON processos
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    public.is_admin_user()
  );
