/*
  # Add Admin Policies for Stripe Tables
  
  1. Changes
    - Add policies to allow admin users to view all stripe_customers data
    - Add policies to allow admin users to view all stripe_subscriptions data
  
  2. Security
    - Policies check if user is admin via user_profiles.is_admin column
    - Only SELECT access is granted (admins cannot modify via these policies)
    - Maintains existing user-specific policies for regular users
*/

-- Add admin SELECT policy for stripe_customers
CREATE POLICY "Admins can view all customer data"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Add admin SELECT policy for stripe_subscriptions
CREATE POLICY "Admins can view all subscription data"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );