/*
  # Remove trigger obsoleto do sistema V1.0
  
  1. Remove o trigger `trigger_calculate_chunk_level` que referencia campo inexistente
  2. Remove a função `calculate_chunk_level()` associada
*/

DROP TRIGGER IF EXISTS trigger_calculate_chunk_level ON processos;
DROP FUNCTION IF EXISTS calculate_chunk_level();
