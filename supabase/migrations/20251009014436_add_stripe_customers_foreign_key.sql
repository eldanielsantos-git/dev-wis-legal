/*
  # Add Foreign Key to stripe_customers table

  1. Changes
    - Add foreign key constraint from stripe_customers.user_id to user_profiles.id
    - This enables PostgREST to automatically resolve relationships
    
  2. Security
    - No changes to RLS policies needed
    - Maintains existing access controls
*/

-- Add foreign key constraint
ALTER TABLE stripe_customers 
ADD CONSTRAINT fk_stripe_customers_user_id 
FOREIGN KEY (user_id) 
REFERENCES user_profiles(id) 
ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id 
ON stripe_customers(user_id);