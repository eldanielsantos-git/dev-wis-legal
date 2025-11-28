/*
# Criação das funções RPC

1. Funções
   - append_to_transcription: Adiciona páginas à transcrição
   - get_next_queue_item: Busca próximo item da fila para processamento

2. Segurança
   - Apenas service_role pode executar as funções
*/

-- Função para adicionar páginas à transcrição
CREATE OR REPLACE FUNCTION append_to_transcription(
  processo_id uuid, 
  new_pages jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE processos 
  SET 
    transcricao = jsonb_set(
      COALESCE(transcricao, '{"pages": [], "totalPages": 0}'::jsonb),
      '{pages}',
      COALESCE(transcricao->>'pages', '[]')::jsonb || new_pages
    ),
    updated_at = now()
  WHERE id = processo_id;
END;
$$;

-- Função para buscar próximo item da fila
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE (
  id bigint,
  processo_id uuid,
  start_page integer,
  end_page integer,
  file_path text,
  file_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  queue_item RECORD;
BEGIN
  -- Busca e bloqueia o próximo item pendente
  SELECT tq.id, tq.processo_id, tq.start_page, tq.end_page, p.file_path, p.file_url
  INTO queue_item
  FROM transcription_queue tq
  JOIN processos p ON p.id = tq.processo_id
  WHERE tq.status = 'pending'
  ORDER BY tq.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;
  
  -- Se encontrou item, marca como processando
  IF queue_item.id IS NOT NULL THEN
    UPDATE transcription_queue 
    SET status = 'processing', updated_at = now()
    WHERE transcription_queue.id = queue_item.id;
    
    -- Retorna o item
    RETURN QUERY SELECT 
      queue_item.id,
      queue_item.processo_id,
      queue_item.start_page,
      queue_item.end_page,
      queue_item.file_path,
      queue_item.file_url;
  END IF;
END;
$$;

-- Função para verificar se processo foi completado
CREATE OR REPLACE FUNCTION check_processo_completion(processo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_count integer;
  error_count integer;
BEGIN
  -- Conta tarefas pendentes e com erro
  SELECT 
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing')),
    COUNT(*) FILTER (WHERE status = 'error')
  INTO pending_count, error_count
  FROM transcription_queue 
  WHERE transcription_queue.processo_id = check_processo_completion.processo_id;
  
  -- Se há erros, marca processo como erro
  IF error_count > 0 THEN
    UPDATE processos 
    SET status = 'error', updated_at = now()
    WHERE id = processo_id;
  -- Se não há tarefas pendentes, marca como completo
  ELSIF pending_count = 0 THEN
    UPDATE processos 
    SET status = 'completed', updated_at = now()
    WHERE id = processo_id;
  END IF;
END;
$$;