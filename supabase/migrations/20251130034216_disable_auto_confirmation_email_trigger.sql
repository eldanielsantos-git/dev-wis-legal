/*
  # Desabilitar envio automático de email de confirmação

  1. Mudanças
    - Remove o trigger que envia email automaticamente quando usuário é criado
    - O email agora será enviado apenas via Mailchimp através do AuthContext
  
  2. Motivo
    - Estava enviando 2 emails: um do Supabase SMTP e outro do Mailchimp
    - Queremos usar apenas o Mailchimp para ter controle total do template e journey
*/

-- Drop the trigger that automatically sends confirmation emails
DROP TRIGGER IF EXISTS trigger_send_confirmation_email ON auth.users;

-- Drop the function if no longer needed
DROP FUNCTION IF EXISTS public.send_confirmation_email_on_signup();