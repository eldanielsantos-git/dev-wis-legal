/*
  # Desabilitar Temporariamente o Trigger de Limpeza para Debug
  
  Desabilitando o trigger clean_analysis_result_content temporariamente
  para investigar por que os resultados das análises 4 e 6 estão ficando vazios.
*/

-- Desabilitar o trigger temporariamente
DROP TRIGGER IF EXISTS trigger_clean_analysis_result_content ON analysis_results;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION clean_analysis_result_content() IS 'TRIGGER DESABILITADO TEMPORARIAMENTE PARA DEBUG - Remove automaticamente texto introdutório e marcadores de código de result_content para garantir JSON válido';
