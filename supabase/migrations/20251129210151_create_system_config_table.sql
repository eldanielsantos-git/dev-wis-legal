/*
  # Create System Configuration Table

  1. Purpose
    - Store system-wide configuration securely
    - Used by triggers and functions to access environment variables
    
  2. Tables
    - system_config: Stores key-value pairs for system configuration
    
  3. Security
    - Only service_role can access this table
    - No RLS needed as it's not accessible by authenticated users
*/

-- Create system config table
CREATE TABLE IF NOT EXISTS system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert configuration values
INSERT INTO system_config (key, value, description)
VALUES 
  ('supabase_url', 'https://rslpleprodloodfsaext.supabase.co', 'Supabase project URL'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHBsZXByb2Rsb29kZnNhZXh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0MjM1NSwiZXhwIjoyMDc5ODE4MzU1fQ.kXjZIGa1SxitKo6axtg5kc4xI8mek3cP5d9LpaLuhHg', 'Service role JWT key')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = now();

-- Enable RLS but no policies - only service_role and postgres can access
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Grant access only to service_role and postgres
GRANT ALL ON system_config TO service_role, postgres;
