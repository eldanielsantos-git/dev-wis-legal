/*
  # Fix Service Role Permissions

  ## Problem
  Edge functions using service_role are getting "permission denied for schema public" errors.
  
  ## Solution
  Grant necessary permissions to service_role on the public schema.
  
  ## Changes
  1. Grant USAGE on schema public to service_role
  2. Grant all privileges on tables to service_role
  3. Grant execute on functions to service_role
  4. Grant usage on sequences to service_role
*/

-- Grant USAGE on schema public to service_role
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant all privileges on all tables to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant EXECUTE on all functions to service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant usage on all sequences to service_role
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Make sure future objects also get these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
