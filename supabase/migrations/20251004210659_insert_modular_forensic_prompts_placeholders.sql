/*
  # Insert Modular Forensic Analysis Prompt Placeholders

  This migration inserts placeholder prompts for the 9-step incremental forensic analysis.
  The full prompts will be updated via the admin interface or a subsequent data migration.

  Categories:
  - ANALISE_FORENSE_ETAPA_1: Metadados e Ingestão
  - ANALISE_FORENSE_ETAPA_2: Cronologia e Visão Geral  
  - ANALISE_FORENSE_ETAPA_3: Análise Forense de Comunicações
  - ANALISE_FORENSE_ETAPA_4: Cálculo de Prazos e Preclusões
  - ANALISE_FORENSE_ETAPA_5: Análise de Questões e Argumentos
  - ANALISE_FORENSE_ETAPA_6: Admissibilidade e Recursos Disponíveis
  - ANALISE_FORENSE_ETAPA_7: Análise Executória e Patrimonial
  - ANALISE_FORENSE_ETAPA_8: Estratégia, Flags e Consolidação Final
  - ANALISE_FORENSE_CONSOLIDACAO: Consolidação Final
*/

-- Clean up any existing modular prompts first
DELETE FROM forensic_prompts 
WHERE category LIKE 'ANALISE_FORENSE_ETAPA_%' 
   OR category = 'ANALISE_FORENSE_CONSOLIDACAO';

-- Insert ETAPA 1: Metadados e Ingestão
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 1/8: METADADOS E INGESTÃO - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_1', 
  1, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 2: Cronologia e Visão Geral
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 2/8: CRONOLOGIA E VISÃO GERAL - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_2', 
  2, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 3: Análise Forense de Comunicações
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 3/8: ANÁLISE FORENSE DE COMUNICAÇÕES - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_3', 
  3, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 4: Cálculo de Prazos e Preclusões
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 4/8: CÁLCULO DE PRAZOS E PRECLUSÕES - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_4', 
  4, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 5: Análise de Questões e Argumentos
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 5/8: ANÁLISE DE QUESTÕES E ARGUMENTOS - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_5', 
  5, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 6: Admissibilidade e Recursos Disponíveis
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 6/8: ADMISSIBILIDADE E RECURSOS DISPONÍVEIS - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_6', 
  6, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 7: Análise Executória e Patrimonial
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 7/8: ANÁLISE EXECUTÓRIA E PATRIMONIAL - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_7', 
  7, 
  true, 
  NOW(), 
  NOW()
);

-- Insert ETAPA 8: Estratégia, Flags e Consolidação Final
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'ETAPA 8/8: ESTRATÉGIA, FLAGS E CONSOLIDAÇÃO FINAL - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_ETAPA_8', 
  8, 
  true, 
  NOW(), 
  NOW()
);

-- Insert CONSOLIDAÇÃO FINAL
INSERT INTO forensic_prompts (prompt_content, version, category, step_order, is_active, created_at, updated_at)
VALUES (
  'CONSOLIDAÇÃO FINAL: MERGE DE TODAS AS ETAPAS - Prompt completo será carregado posteriormente via admin.',
  1, 
  'ANALISE_FORENSE_CONSOLIDACAO', 
  9, 
  true, 
  NOW(), 
  NOW()
);

-- Verify insertion
SELECT id, category, step_order, is_active, created_at 
FROM forensic_prompts 
WHERE category LIKE 'ANALISE_FORENSE_%'
ORDER BY step_order;
