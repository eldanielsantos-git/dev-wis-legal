/*
  # Create RPC functions for transcription processing

  1. Database Functions
    - `get_next_queue_item()` - Busca próximo item da fila para processar
    - `append_to_transcription()` - Adiciona páginas transcritas ao processo
    - `check_processo_completion()` - Verifica se processo foi concluído

  2. Security
    - Functions are accessible by service_role and authenticated users
    - Atomic operations to prevent race conditions
*/

-- Função para buscar próximo item da fila
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE(
  id bigint,
  processo_id uuid,
  start_page integer,
  end_page integer,
  file_path text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Busca e marca como processando atomicamente
  UPDATE transcription_queue
  SET status = 'processing'
  WHERE id = (
    SELECT tq.id 
    FROM transcription_queue tq
    JOIN processos p ON p.id = tq.processo_id
    WHERE tq.status = 'pending'
    ORDER BY tq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  );
  
  -- Retorna o item atualizado com dados do processo
  RETURN QUERY
  SELECT 
    tq.id,
    tq.processo_id,
    tq.start_page,
    tq.end_page,
    p.file_path
  FROM transcription_queue tq
  JOIN processos p ON p.id = tq.processo_id
  WHERE tq.status = 'processing'
  ORDER BY tq.created_at ASC
  LIMIT 1;
END;
$$;

-- Função para adicionar páginas transcritas
CREATE OR REPLACE FUNCTION append_to_transcription(
  processo_id uuid,
  new_pages jsonb
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  current_transcricao jsonb;
  updated_transcricao jsonb;
BEGIN
  -- Busca transcrição atual
  SELECT transcricao INTO current_transcricao
  FROM processos 
  WHERE id = processo_id;
  
  -- Se não existe transcrição, cria estrutura inicial
  IF current_transcricao IS NULL THEN
    current_transcricao := jsonb_build_object('pages', '[]'::jsonb, 'totalPages', 0);
  END IF;
  
  -- Adiciona novas páginas ao array existente
  updated_transcricao := jsonb_set(
    current_transcricao,
    '{pages}',
    (current_transcricao->'pages') || new_pages
  );
  
  -- Atualiza processo
  UPDATE processos 
  SET 
    transcricao = updated_transcricao,
    updated_at = now()
  WHERE id = processo_id;
  
  -- Log da operação
  INSERT INTO transcription_logs (processo_id, action, details)
  VALUES (
    processo_id,
    'pages_added',
    jsonb_build_object(
      'pages_count', jsonb_array_length(new_pages),
      'total_pages', jsonb_array_length(updated_transcricao->'pages')
    )
  );
END;
$$;

-- Função para verificar se processo foi concluído
CREATE OR REPLACE FUNCTION check_processo_completion(
  processo_id uuid
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  pending_count integer;
  error_count integer;
  completed_count integer;
  total_count integer;
BEGIN
  -- Conta itens por status
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'error') as errors,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) as total
  INTO pending_count, error_count, completed_count, total_count
  FROM transcription_queue 
  WHERE transcription_queue.processo_id = check_processo_completion.processo_id;
  
  -- Se todos os itens foram processados (completed + error = total)
  IF pending_count = 0 AND total_count > 0 THEN
    IF error_count = 0 THEN
      -- Todos concluídos com sucesso
      UPDATE processos 
      SET status = 'completed', updated_at = now()
      WHERE id = processo_id;
      
      INSERT INTO transcription_logs (processo_id, action, details)
      VALUES (
        processo_id,
        'processo_completed',
        jsonb_build_object('total_items', total_count)
      );
    ELSE
      -- Alguns itens com erro
      UPDATE processos 
      SET status = 'error', updated_at = now()
      WHERE id = processo_id;
      
      INSERT INTO transcription_logs (processo_id, action, details)
      VALUES (
        processo_id,
        'processo_error',
        jsonb_build_object(
          'total_items', total_count,
          'error_items', error_count,
          'completed_items', completed_count
        )
      );
    END IF;
  END IF;
END;
$$;

-- Grants para as funções
GRANT EXECUTE ON FUNCTION get_next_queue_item() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION append_to_transcription(uuid, jsonb) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION check_processo_completion(uuid) TO service_role, authenticated;