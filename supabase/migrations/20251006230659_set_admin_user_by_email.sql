/*
  # Set admin flag for specific user

  1. Changes
    - Create function to set admin flag based on email
    - Trigger to automatically set admin for daniel@dmzdigital.com.br
  
  2. Security
    - Only affects specific email address
    - Runs on user_profiles insert
*/

-- Function to set admin flag for specific email
CREATE OR REPLACE FUNCTION set_admin_for_specific_email()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = NEW.id
    AND auth.users.email = 'daniel@dmzdigital.com.br'
  ) THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_admin_for_specific_email ON user_profiles;
CREATE TRIGGER trigger_set_admin_for_specific_email
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_admin_for_specific_email();