/*
  # Add Admin Update Policy for Stripe Subscriptions

  1. Changes
    - Add UPDATE policy for stripe_subscriptions table allowing admins to update subscription data
    - This enables admins to add extra tokens to user subscriptions
  
  2. Security
    - Only users with is_admin = true can update
    - Maintains data integrity by restricting updates to admin users only
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'stripe_subscriptions' 
    AND policyname = 'Admins can update stripe_subscriptions'
  ) THEN
    CREATE POLICY "Admins can update stripe_subscriptions"
      ON stripe_subscriptions
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.is_admin = true
        )
      );
  END IF;
END $$;
