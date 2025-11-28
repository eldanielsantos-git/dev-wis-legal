/*
  # Migração de Usuários - Origem para Destino (ARRJ-Dev)

  Este script migra 5 usuários do ambiente de origem para o ARRJ-Dev,
  preservando:
  - IDs originais (para manter relações)
  - Senhas encriptadas
  - Metadados (OAuth, perfis, etc)
  - Perfis de usuário (user_profiles)
  - Permissões de admin

  ATENÇÃO: Execute este script MANUALMENTE no SQL Editor do Supabase Dashboard
  do projeto ARRJ-Dev (rslpleprodloodfsaext)
*/

-- =====================================================
-- PARTE 1: Migrar usuários para auth.users
-- =====================================================

-- Usuário 1: Daniel Santos (Admin)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '87a4f9e4-db30-4dfe-957d-8122b66b7015'::uuid,
  'authenticated',
  'authenticated',
  'daniel@dmzdigital.com.br',
  '$2a$10$fDqhj.Jx0NxmO.3YUf1P4ehnxwUBxtOzJtwgcU.ldjAsHiMcTOvDG',
  '2025-10-06 23:12:53.56099+00',
  '{"provider":"email","providers":["email","google"]}'::jsonb,
  '{"iss":"https://accounts.google.com","sub":"114622583704731644631","name":"Daniel Santos","email":"daniel@dmzdigital.com.br","picture":"https://lh3.googleusercontent.com/a/ACg8ocJE8ftCqlMn4XRoZhQrlgo61woKUWHIywyyYV5TjZYRRpUjnpQ=s96-c","full_name":"Daniel Santos","avatar_url":"https://lh3.googleusercontent.com/a/ACg8ocJE8ftCqlMn4XRoZhQrlgo61woKUWHIywyyYV5TjZYRRpUjnpQ=s96-c","provider_id":"114622583704731644631","custom_claims":{"hd":"dmzdigital.com.br"},"email_verified":true,"phone_verified":false}'::jsonb,
  '2025-10-06 23:12:53.56099+00',
  '2025-11-27 14:07:50.469951+00',
  '2025-11-26 00:01:05.161935+00',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Usuário 2: João Pedro Raupp (Admin)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '45ef022b-5963-42b9-9bc3-936a1d3de22a'::uuid,
  'authenticated',
  'authenticated',
  'jp@dmzdigital.com.br',
  '$2a$06$PzWPKSumoVUY9NvVLijuYuJpnWpbJtS1m0sIGjF89WzaXZZbPZl5K',
  '2025-10-06 23:14:28.031418+00',
  '{"provider":"email","providers":["email","google"]}'::jsonb,
  '{"iss":"https://accounts.google.com","sub":"114847590530701049214","name":"João Pedro Raupp","email":"jp@dmzdigital.com.br","picture":"https://lh3.googleusercontent.com/a/ACg8ocJEnkaVC3egchkccj1tATS7CKywRjVbMhv2FcekVDv4u-1PXw=s96-c","full_name":"João Pedro Raupp","avatar_url":"https://lh3.googleusercontent.com/a/ACg8ocJEnkaVC3egchkccj1tATS7CKywRjVbMhv2FcekVDv4u-1PXw=s96-c","provider_id":"114847590530701049214","custom_claims":{"hd":"dmzdigital.com.br"},"email_verified":true,"phone_verified":false}'::jsonb,
  '2025-10-06 23:14:28.031418+00',
  '2025-11-27 13:31:10.308732+00',
  '2025-11-25 12:14:00.358558+00',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Usuário 3: Joao Raupp (Google OAuth)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '4981cbe6-ce57-440f-aedc-46aefe0b275f'::uuid,
  'authenticated',
  'authenticated',
  'rauppj3@gmail.com',
  NULL,
  '2025-11-19 20:55:03.232971+00',
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"iss":"https://accounts.google.com","sub":"104090152326855810411","name":"Joao Raupp","email":"rauppj3@gmail.com","picture":"https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c","full_name":"Joao Raupp","avatar_url":"https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c","provider_id":"104090152326855810411","email_verified":true,"phone_verified":false}'::jsonb,
  '2025-11-19 20:55:03.222293+00',
  '2025-11-25 13:14:05.341775+00',
  '2025-11-19 20:55:03.234734+00',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Usuário 4: Joao Teste Pg
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'c805c172-3d3d-4fbd-870c-a8a08706a86a'::uuid,
  'authenticated',
  'authenticated',
  'jp+2025@dmzdigital.com.br',
  '$2a$10$KP3WtrVXx6Saa/F0L5WEqejA1UTMMZYmOHjF9Ouc/EYwJ8nuQy4BK',
  '2025-11-20 13:37:01.762068+00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"oab":"88.888","sub":"c805c172-3d3d-4fbd-870c-a8a08706a86a","city":"Pelotas","email":"jp+2025@dmzdigital.com.br","phone":"(11) 95801-4505","state":"Rio Grande do Sul","last_name":"Teste Pg","first_name":"Joao","email_verified":true,"phone_verified":false,"phone_country_code":"+55"}'::jsonb,
  '2025-11-20 13:36:09.763513+00',
  '2025-11-20 13:37:01.767852+00',
  '2025-11-20 13:37:01.765144+00',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Usuário 5: Twan (Google OAuth)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '5429474f-97c2-4e61-b537-0da7099a85b1'::uuid,
  'authenticated',
  'authenticated',
  'twaning2222@gmail.com',
  NULL,
  '2025-11-25 12:18:10.359766+00',
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"iss":"https://accounts.google.com","sub":"103879016658438473014","name":"Twan","email":"twaning2222@gmail.com","picture":"https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c","full_name":"Twan","avatar_url":"https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c","provider_id":"103879016658438473014","email_verified":true,"phone_verified":false}'::jsonb,
  '2025-11-25 12:18:10.342809+00',
  '2025-11-25 12:18:10.365863+00',
  '2025-11-25 12:18:10.36338+00',
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PARTE 2: Migrar perfis de usuário para user_profiles
-- =====================================================

-- Perfil 1: Daniel Santos (Admin)
INSERT INTO user_profiles (
  id,
  first_name,
  last_name,
  avatar_url,
  oab,
  phone,
  phone_country_code,
  city,
  state,
  is_admin,
  theme_preference,
  terms_accepted_at,
  email,
  created_at,
  updated_at
) VALUES (
  '87a4f9e4-db30-4dfe-957d-8122b66b7015'::uuid,
  'Daniel',
  'Santos',
  'https://zvlqcxiwsrziuodiotar.supabase.co/storage/v1/object/public/avatars/87a4f9e4-db30-4dfe-957d-8122b66b7015/avatar.JPG',
  NULL,
  '+55 11987556013',
  '+55',
  'São Paulo',
  'SP',
  true,
  'dark',
  '2025-10-06 23:12:53.56099+00',
  'daniel@dmzdigital.com.br',
  '2025-10-06 23:12:53.56099+00',
  '2025-11-15 15:05:51.501571+00'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  avatar_url = EXCLUDED.avatar_url,
  oab = EXCLUDED.oab,
  phone = EXCLUDED.phone,
  phone_country_code = EXCLUDED.phone_country_code,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  is_admin = EXCLUDED.is_admin,
  theme_preference = EXCLUDED.theme_preference,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;

-- Perfil 2: João Pedro Raupp (Admin)
INSERT INTO user_profiles (
  id,
  first_name,
  last_name,
  avatar_url,
  oab,
  phone,
  phone_country_code,
  city,
  state,
  is_admin,
  theme_preference,
  terms_accepted_at,
  email,
  created_at,
  updated_at
) VALUES (
  '45ef022b-5963-42b9-9bc3-936a1d3de22a'::uuid,
  'João Pedro',
  'Raupp',
  '',
  '61.178',
  '+55 (11) 95801-4505',
  '+55',
  'Pelotas',
  'Rio Grande do Sul',
  true,
  'dark',
  '2025-10-06 23:14:28.031418+00',
  'jp@dmzdigital.com.br',
  '2025-10-06 23:14:28.031418+00',
  '2025-10-06 23:14:28.031418+00'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  avatar_url = EXCLUDED.avatar_url,
  oab = EXCLUDED.oab,
  phone = EXCLUDED.phone,
  phone_country_code = EXCLUDED.phone_country_code,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  is_admin = EXCLUDED.is_admin,
  theme_preference = EXCLUDED.theme_preference,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;

-- Perfil 3: Joao Raupp
INSERT INTO user_profiles (
  id,
  first_name,
  last_name,
  avatar_url,
  oab,
  phone,
  phone_country_code,
  city,
  state,
  is_admin,
  theme_preference,
  terms_accepted_at,
  email,
  created_at,
  updated_at
) VALUES (
  '4981cbe6-ce57-440f-aedc-46aefe0b275f'::uuid,
  'Joao',
  'Raupp',
  'https://lh3.googleusercontent.com/a/ACg8ocLUwUds9U6A1g0bNlrxnY-RLOZ4AA-Np3Ml8P6obsy2lXiycg=s96-c',
  NULL,
  NULL,
  '+55',
  NULL,
  NULL,
  false,
  'dark',
  '2025-11-19 20:55:03.219918+00',
  'rauppj3@gmail.com',
  '2025-11-19 20:55:03.219918+00',
  '2025-11-19 20:55:03.219918+00'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  avatar_url = EXCLUDED.avatar_url,
  phone_country_code = EXCLUDED.phone_country_code,
  theme_preference = EXCLUDED.theme_preference,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;

-- Perfil 4: Joao Teste Pg
INSERT INTO user_profiles (
  id,
  first_name,
  last_name,
  avatar_url,
  oab,
  phone,
  phone_country_code,
  city,
  state,
  is_admin,
  theme_preference,
  terms_accepted_at,
  email,
  created_at,
  updated_at
) VALUES (
  'c805c172-3d3d-4fbd-870c-a8a08706a86a'::uuid,
  'Joao',
  'Teste Pg',
  NULL,
  '88.888',
  '(11) 95801-4505',
  '+55',
  'Pelotas',
  'Rio Grande do Sul',
  false,
  'dark',
  '2025-11-20 13:36:09.763178+00',
  'jp+2025@dmzdigital.com.br',
  '2025-11-20 13:36:09.763178+00',
  '2025-11-20 13:36:09.763178+00'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  oab = EXCLUDED.oab,
  phone = EXCLUDED.phone,
  phone_country_code = EXCLUDED.phone_country_code,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  theme_preference = EXCLUDED.theme_preference,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;

-- Perfil 5: Twan
INSERT INTO user_profiles (
  id,
  first_name,
  last_name,
  avatar_url,
  oab,
  phone,
  phone_country_code,
  city,
  state,
  is_admin,
  theme_preference,
  terms_accepted_at,
  email,
  created_at,
  updated_at
) VALUES (
  '5429474f-97c2-4e61-b537-0da7099a85b1'::uuid,
  'Twan',
  '',
  'https://lh3.googleusercontent.com/a/ACg8ocKRwhs0O3Inhmx6k0dDb0VsU80oMgAkvt6Paj4bkWcORanTmts=s96-c',
  NULL,
  NULL,
  '+55',
  NULL,
  NULL,
  false,
  'dark',
  '2025-11-25 12:18:10.336154+00',
  'twaning2222@gmail.com',
  '2025-11-25 12:18:10.336154+00',
  '2025-11-25 12:18:10.336154+00'
) ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  avatar_url = EXCLUDED.avatar_url,
  phone_country_code = EXCLUDED.phone_country_code,
  theme_preference = EXCLUDED.theme_preference,
  email = EXCLUDED.email,
  updated_at = EXCLUDED.updated_at;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Verificar usuários migrados
SELECT
  u.id,
  u.email,
  u.created_at,
  p.first_name,
  p.last_name,
  p.is_admin
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
WHERE u.id IN (
  '87a4f9e4-db30-4dfe-957d-8122b66b7015',
  '45ef022b-5963-42b9-9bc3-936a1d3de22a',
  '4981cbe6-ce57-440f-aedc-46aefe0b275f',
  'c805c172-3d3d-4fbd-870c-a8a08706a86a',
  '5429474f-97c2-4e61-b537-0da7099a85b1'
)
ORDER BY u.created_at;
