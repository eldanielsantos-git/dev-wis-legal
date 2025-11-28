/*
  # Enable Realtime for Token Tables
  
  1. Changes
    - Enable realtime for stripe_subscriptions table
    - Enable realtime for token_usage_logs table
    - Enable realtime for token_usage_history table
    
  2. Purpose
    - Allow frontend to receive real-time updates when tokens are debited
    - Enable live token balance updates in the UI
*/

-- Enable realtime for stripe_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE stripe_subscriptions;

-- Enable realtime for token_usage_logs
ALTER PUBLICATION supabase_realtime ADD TABLE token_usage_logs;

-- Enable realtime for token_usage_history
ALTER PUBLICATION supabase_realtime ADD TABLE token_usage_history;
