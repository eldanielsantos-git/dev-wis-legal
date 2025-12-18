/*
  # Add INSERT policy for user achievements

  ## Changes
  - Adds INSERT policy for authenticated users to insert their own achievements
  
  ## Security
  - Users can only insert achievements for themselves (user_id = auth.uid())
  - Prevents users from creating achievements for other users
*/

CREATE POLICY "Users can insert own achievements"
  ON user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
