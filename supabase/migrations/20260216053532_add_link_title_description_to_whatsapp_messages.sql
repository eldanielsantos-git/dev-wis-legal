/*
  # Adicionar campos de titulo e descricao para links WhatsApp

  1. Alteracoes
    - Adiciona coluna `link_title` para titulo do link preview
    - Adiciona coluna `link_description` para descricao do link preview
    - Atualiza mensagens existentes com valores padrao

  2. Objetivo
    - Permitir customizacao do titulo e descricao que aparecem no preview dos links enviados via WhatsApp
    - Evitar repeticao de conteudo entre mensagem e preview do link
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wis_whatsapp_messages' AND column_name = 'link_title'
  ) THEN
    ALTER TABLE wis_whatsapp_messages ADD COLUMN link_title text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wis_whatsapp_messages' AND column_name = 'link_description'
  ) THEN
    ALTER TABLE wis_whatsapp_messages ADD COLUMN link_description text DEFAULT '';
  END IF;
END $$;

UPDATE wis_whatsapp_messages
SET 
  link_title = 'Detalhes da Analise',
  link_description = 'Veja todos os detalhes e gerencie compartilhamento'
WHERE message_key = 'detail_link' AND (link_title IS NULL OR link_title = '');

UPDATE wis_whatsapp_messages
SET 
  link_title = 'Wis Legal Chat',
  link_description = 'Converse sobre seu processo e tire duvidas'
WHERE message_key = 'chat_link' AND (link_title IS NULL OR link_title = '');

UPDATE wis_whatsapp_messages
SET 
  link_title = 'Analise Completa',
  link_description = 'PDF com o resumo da analise do seu processo'
WHERE message_key = 'analysis_completed' AND (link_title IS NULL OR link_title = '');