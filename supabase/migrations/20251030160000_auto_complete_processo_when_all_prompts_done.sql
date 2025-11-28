/*
  # Auto-Complete Processo When All Prompts Done

  Esta migration cria um trigger que automaticamente marca um processo como 'completed'
  quando todos os seus analysis_results estão com status 'completed'.

  1. Nova Função
    - `check_and_complete_processo()`: Verifica se todos os prompts foram concluídos
      e atualiza o status do processo automaticamente

  2. Trigger
    - Executa após UPDATE ou INSERT em `analysis_results`
    - Verifica se é o último prompt sendo completado
    - Atualiza o processo para 'completed' automaticamente

  3. Benefícios
    - Garante que processos sempre sejam marcados como concluídos
    - Funciona mesmo se a edge function falhar ou o frontend perder conexão
    - Redundância para garantir consistência de dados
*/

-- Create function to check and complete processo
CREATE OR REPLACE FUNCTION check_and_complete_processo()
RETURNS TRIGGER AS $$
DECLARE
  v_total_prompts INT;
  v_completed_prompts INT;
  v_processo_status TEXT;
BEGIN
  -- Only proceed if the updated analysis_result is now completed
  IF NEW.status = 'completed' THEN
    -- Get current processo status
    SELECT status INTO v_processo_status
    FROM processos
    WHERE id = NEW.processo_id;

    -- Only proceed if processo is not already completed
    IF v_processo_status != 'completed' THEN
      -- Count total analysis_results for this processo
      SELECT COUNT(*) INTO v_total_prompts
      FROM analysis_results
      WHERE processo_id = NEW.processo_id;

      -- Count completed analysis_results
      SELECT COUNT(*) INTO v_completed_prompts
      FROM analysis_results
      WHERE processo_id = NEW.processo_id
        AND status = 'completed';

      -- If all prompts are completed, mark processo as completed
      IF v_total_prompts > 0 AND v_total_prompts = v_completed_prompts THEN
        UPDATE processos
        SET
          status = 'completed',
          analysis_completed_at = NOW()
        WHERE id = NEW.processo_id
          AND status != 'completed'; -- Extra safety check

        RAISE NOTICE '✅ Processo % automaticamente marcado como completed (% de % prompts concluídos)',
          NEW.processo_id, v_completed_prompts, v_total_prompts;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_complete_processo ON analysis_results;

CREATE TRIGGER trigger_auto_complete_processo
  AFTER UPDATE OR INSERT ON analysis_results
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION check_and_complete_processo();

-- Add comment
COMMENT ON FUNCTION check_and_complete_processo() IS
  'Automatically marks a processo as completed when all its analysis_results are completed';
