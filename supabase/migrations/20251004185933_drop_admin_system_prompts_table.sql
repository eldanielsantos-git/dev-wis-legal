/*
  # Remove tabela admin_system_prompts

  1. Remoção
    - Drop da tabela `admin_system_prompts`
    - Esta tabela não é mais necessária pois foi substituída pela tabela `forensic_prompts`
  
  2. Justificativa
    - A funcionalidade de "Prompts do Sistema" foi removida da interface
    - Agora existe apenas "Prompts Forenses" que usa a tabela `forensic_prompts`
*/

-- Remover a tabela admin_system_prompts
DROP TABLE IF EXISTS admin_system_prompts CASCADE;
