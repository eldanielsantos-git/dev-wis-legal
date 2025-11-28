/*
  # Create Admin User - Version 2

  1. Changes
    - Creates admin user daniel@dmzdigital.com.br
    - Sets up user profile with admin privileges
    - Includes provider_id in identities
  
  2. Security
    - User is created with hashed password
    - Admin flag is set to true
*/

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'daniel@dmzdigital.com.br';
  v_encrypted_password text;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    v_encrypted_password := crypt('D4n13l@pass', gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Insert identity with provider_id
    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id::text,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id::text, v_email)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Create user profile with admin privileges
    INSERT INTO user_profiles (
      id,
      first_name,
      last_name,
      is_admin,
      terms_accepted_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      'Daniel',
      'Admin',
      true,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Admin user created: %', v_user_id;
  ELSE
    UPDATE user_profiles SET is_admin = true WHERE id = v_user_id;
    RAISE NOTICE 'User exists, admin flag updated: %', v_user_id;
  END IF;
END $$;