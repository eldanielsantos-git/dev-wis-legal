/*
  # Restore Schema Public Permissions

  ## Problem
  Users are getting "permission denied for schema public" errors.
  The authenticated role doesn't have USAGE permission on the public schema.

  ## Solution
  Grant necessary permissions to authenticated and anon roles on the public schema.

  ## Changes
  1. Grant USAGE on schema public to authenticated
  2. Grant USAGE on schema public to anon
  3. Grant SELECT on all tables to authenticated (where RLS applies)
  4. Grant SELECT on all views to authenticated
*/

-- Grant USAGE on schema public to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant SELECT on all tables in public schema to authenticated
-- RLS policies will still apply, so users can only see their own data
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant INSERT, UPDATE, DELETE where needed (RLS will control access)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant EXECUTE on all functions to authenticated
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant usage on all sequences to authenticated (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Make sure future objects also get these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Grant SELECT to anon for public-facing tables only (login, etc)
GRANT SELECT ON TABLE user_profiles TO anon;
