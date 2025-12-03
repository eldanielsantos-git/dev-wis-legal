/*
  Script para Deletar Processo Travado

  Processo ID: 8f2904f8-9245-45ca-8a63-72d37efbf3ec

  Este script remove completamente o processo e todos os dados relacionados:
  - process_chunks
  - processing_queue
  - complex_processing_status
  - analysis_results
  - chat_messages
  - processos (principal)

  IMPORTANTE: Execute no Supabase SQL Editor
*/

-- 1. Remover chunks do processo
DELETE FROM process_chunks
WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- 2. Remover itens da fila de processamento
DELETE FROM processing_queue
WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- 3. Remover status de processamento complexo
DELETE FROM complex_processing_status
WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- 4. Remover resultados de análise
DELETE FROM analysis_results
WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- 5. Remover mensagens de chat (se houver)
DELETE FROM chat_messages
WHERE processo_id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- 6. Finalmente, remover o processo principal
DELETE FROM processos
WHERE id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- Verificar se foi removido
SELECT COUNT(*) as processos_restantes
FROM processos
WHERE id = '8f2904f8-9245-45ca-8a63-72d37efbf3ec';

-- Deve retornar 0
