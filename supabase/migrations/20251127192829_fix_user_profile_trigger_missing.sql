/*
  # Fix Missing User Profile Trigger

  1. Problem
    - O trigger que cria automaticamente user_profiles quando um usuário faz login não existe
    - Usuários conseguem fazer login mas seus dados não carregam
    - A função handle_new_user() existe mas o trigger não está vinculado

  2. Solution
    - Recriar o trigger on_auth_user_created na tabela auth.users
    - Vincular ao handle_new_user() existente
    - Executar AFTER INSERT para criar profile automaticamente

  3. Security
    - Mantém RLS existente
    - Usa SECURITY DEFINER na função (já configurado)
*/

-- Recriar o trigger que estava faltando
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
