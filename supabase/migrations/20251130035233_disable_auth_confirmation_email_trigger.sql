/*
  # Desabilitar envio automático de email pelo Supabase Auth

  1. Mudanças
    - Remove o trigger on_auth_user_created_send_email da tabela auth.users
    - Remove a função trigger_send_confirmation_email() se existir
  
  2. Motivo
    - O Supabase continua enviando email via SMTP próprio
    - Queremos usar apenas o Mailchimp via edge function manual
*/

-- Drop the trigger on auth.users (requires proper permissions)
DROP TRIGGER IF EXISTS on_auth_user_created_send_email ON auth.users;

-- Drop the function if no longer needed
DROP FUNCTION IF EXISTS public.trigger_send_confirmation_email();