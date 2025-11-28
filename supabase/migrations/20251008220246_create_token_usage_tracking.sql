/*
  # Token Usage Tracking System

  1. New Tables
    - `token_usage_logs`
      - Tracks individual token usage per operation
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `processo_id` (uuid, references processos)
      - `operation_type` (text) - type of operation (transcription, forensic_analysis, etc.)
      - `tokens_used` (integer) - number of tokens consumed
      - `model_name` (text) - AI model used
      - `created_at` (timestamptz)
    
    - `user_token_quotas`
      - Manages token quotas per user
      - `user_id` (uuid, primary key, references auth.users)
      - `monthly_quota` (integer) - monthly token limit
      - `tokens_used_this_month` (integer) - tokens used in current month
      - `quota_reset_date` (timestamptz) - when quota resets
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view their own token usage
    - Admins can view all token usage
    - Only system can insert token usage logs
    - Admins can manage user quotas

  3. Functions
    - Function to automatically track token usage
    - Function to check if user has available tokens
    - Function to reset monthly quotas
*/

-- Create token_usage_logs table
CREATE TABLE IF NOT EXISTS token_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE,
  operation_type text NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  model_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create user_token_quotas table
CREATE TABLE IF NOT EXISTS user_token_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_quota integer NOT NULL DEFAULT 1000000,
  tokens_used_this_month integer NOT NULL DEFAULT 0,
  quota_reset_date timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_user_id ON token_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_processo_id ON token_usage_logs(processo_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_created_at ON token_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_logs_operation_type ON token_usage_logs(operation_type);

-- Enable RLS
ALTER TABLE token_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_token_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for token_usage_logs

-- Users can view their own token usage
CREATE POLICY "Users can view own token usage"
  ON token_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all token usage
CREATE POLICY "Admins can view all token usage"
  ON token_usage_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Only service role can insert token usage logs
CREATE POLICY "Service role can insert token usage"
  ON token_usage_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies for user_token_quotas

-- Users can view their own quota
CREATE POLICY "Users can view own quota"
  ON user_token_quotas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all quotas
CREATE POLICY "Admins can view all quotas"
  ON user_token_quotas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Admins can update quotas
CREATE POLICY "Admins can update quotas"
  ON user_token_quotas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role can insert and update quotas
CREATE POLICY "Service role can manage quotas"
  ON user_token_quotas FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if user has available tokens
CREATE OR REPLACE FUNCTION check_token_availability(
  p_user_id uuid,
  p_tokens_needed integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota record;
BEGIN
  -- Get user's quota
  SELECT * INTO v_quota
  FROM user_token_quotas
  WHERE user_id = p_user_id;

  -- If no quota exists, create default quota
  IF NOT FOUND THEN
    INSERT INTO user_token_quotas (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_quota;
  END IF;

  -- Check if quota needs reset
  IF v_quota.quota_reset_date <= now() THEN
    UPDATE user_token_quotas
    SET tokens_used_this_month = 0,
        quota_reset_date = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_quota;
  END IF;

  -- Check if user has enough tokens
  RETURN (v_quota.tokens_used_this_month + p_tokens_needed) <= v_quota.monthly_quota;
END;
$$;

-- Function to log token usage
CREATE OR REPLACE FUNCTION log_token_usage(
  p_user_id uuid,
  p_processo_id uuid,
  p_operation_type text,
  p_tokens_used integer,
  p_model_name text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert usage log
  INSERT INTO token_usage_logs (
    user_id,
    processo_id,
    operation_type,
    tokens_used,
    model_name,
    metadata
  ) VALUES (
    p_user_id,
    p_processo_id,
    p_operation_type,
    p_tokens_used,
    p_model_name,
    p_metadata
  );

  -- Update user's quota
  INSERT INTO user_token_quotas (user_id, tokens_used_this_month)
  VALUES (p_user_id, p_tokens_used)
  ON CONFLICT (user_id)
  DO UPDATE SET
    tokens_used_this_month = user_token_quotas.tokens_used_this_month + p_tokens_used,
    updated_at = now();
END;
$$;

-- Function to reset monthly quotas (to be called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_token_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_token_quotas
  SET tokens_used_this_month = 0,
      quota_reset_date = date_trunc('month', now()) + interval '1 month',
      updated_at = now()
  WHERE quota_reset_date <= now();
END;
$$;

-- Function to get user token usage summary
CREATE OR REPLACE FUNCTION get_user_token_usage_summary(p_user_id uuid)
RETURNS TABLE (
  total_tokens_used bigint,
  tokens_this_month integer,
  monthly_quota integer,
  quota_remaining integer,
  quota_reset_date timestamptz,
  usage_by_operation jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH quota AS (
    SELECT 
      utq.monthly_quota,
      utq.tokens_used_this_month,
      utq.quota_reset_date
    FROM user_token_quotas utq
    WHERE utq.user_id = p_user_id
  ),
  total_usage AS (
    SELECT COALESCE(SUM(tokens_used), 0) as total
    FROM token_usage_logs
    WHERE user_id = p_user_id
  ),
  operation_usage AS (
    SELECT jsonb_object_agg(
      operation_type,
      jsonb_build_object(
        'tokens', total_tokens,
        'count', operation_count
      )
    ) as usage_json
    FROM (
      SELECT 
        operation_type,
        SUM(tokens_used) as total_tokens,
        COUNT(*) as operation_count
      FROM token_usage_logs
      WHERE user_id = p_user_id
      GROUP BY operation_type
    ) ops
  )
  SELECT
    (SELECT total FROM total_usage),
    COALESCE(q.tokens_used_this_month, 0),
    COALESCE(q.monthly_quota, 1000000),
    COALESCE(q.monthly_quota - q.tokens_used_this_month, 1000000),
    COALESCE(q.quota_reset_date, date_trunc('month', now()) + interval '1 month'),
    COALESCE(ou.usage_json, '{}'::jsonb)
  FROM quota q
  CROSS JOIN operation_usage ou;
END;
$$;
