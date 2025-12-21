/*
  # Atualização do Sistema de Tiers - Adicionar HIGH_LARGE e ULTRA_LARGE
  
  ## Objetivo
  Adicionar dois novos tiers ao sistema para melhor controle de documentos grandes:
  - HIGH_LARGE: 10001-20000 páginas (substitui MASSIVE)
  - ULTRA_LARGE: 20001+ páginas (novo)
  
  ## Mudanças
  
  1. Atualizar constraints em todas as tabelas relacionadas
  2. Atualizar chunk_size_pages para melhor performance
  3. Criar feature flags para os novos tiers
  
  ## Configuração Final de Tiers
  
  | Tier        | Páginas        | Chunk Size | Paralelo | Timeout |
  |-------------|----------------|------------|----------|---------|
  | SMALL       | até 1000       | N/A        | 1        | 15 min  |
  | MEDIUM      | 1001-2000      | 400        | 3        | 20 min  |
  | LARGE       | 2001-5000      | 180        | 4        | 25 min  |
  | VERY_LARGE  | 5001-10000     | 180        | 5        | 30 min  |
  | HIGH_LARGE  | 10001-20000    | 180        | 5        | 35 min  |
  | ULTRA_LARGE | 20001+         | 100        | 6        | 40 min  |
*/

-- Desabilitar triggers temporariamente
SET session_replication_role = replica;

-- 1. ATUALIZAR CONSTRAINTS

-- Ampliar constraint de priority para aceitar valores de 1 a 6
ALTER TABLE processing_tier_config 
DROP CONSTRAINT IF EXISTS processing_tier_config_priority_check;

ALTER TABLE processing_tier_config
ADD CONSTRAINT processing_tier_config_priority_check 
CHECK (priority >= 1 AND priority <= 6);

-- Atualizar constraint de tier_name em processing_tier_config
ALTER TABLE processing_tier_config 
DROP CONSTRAINT IF EXISTS processing_tier_config_tier_name_check;

ALTER TABLE processing_tier_config
ADD CONSTRAINT processing_tier_config_tier_name_check 
CHECK (tier_name = ANY (ARRAY['SMALL'::text, 'MEDIUM'::text, 'LARGE'::text, 'VERY_LARGE'::text, 'MASSIVE'::text, 'HIGH_LARGE'::text, 'ULTRA_LARGE'::text]));

-- Atualizar constraint de tier_name em processos
ALTER TABLE processos 
DROP CONSTRAINT IF EXISTS processos_tier_name_check;

ALTER TABLE processos
ADD CONSTRAINT processos_tier_name_check 
CHECK (tier_name IS NULL OR tier_name = ANY (ARRAY['SMALL'::text, 'MEDIUM'::text, 'LARGE'::text, 'VERY_LARGE'::text, 'MASSIVE'::text, 'HIGH_LARGE'::text, 'ULTRA_LARGE'::text]));

-- Atualizar constraint de tier_name em process_chunks
ALTER TABLE process_chunks 
DROP CONSTRAINT IF EXISTS process_chunks_tier_name_check;

ALTER TABLE process_chunks
ADD CONSTRAINT process_chunks_tier_name_check 
CHECK (tier_name IS NULL OR tier_name = ANY (ARRAY['SMALL'::text, 'MEDIUM'::text, 'LARGE'::text, 'VERY_LARGE'::text, 'MASSIVE'::text, 'HIGH_LARGE'::text, 'ULTRA_LARGE'::text]));

-- Atualizar constraint de tier_name em complex_processing_status
ALTER TABLE complex_processing_status 
DROP CONSTRAINT IF EXISTS complex_processing_status_tier_name_check;

ALTER TABLE complex_processing_status
ADD CONSTRAINT complex_processing_status_tier_name_check 
CHECK (tier_name IS NULL OR tier_name = ANY (ARRAY['SMALL'::text, 'MEDIUM'::text, 'LARGE'::text, 'VERY_LARGE'::text, 'MASSIVE'::text, 'HIGH_LARGE'::text, 'ULTRA_LARGE'::text]));

-- Atualizar constraint de tier_name em complex_analysis_errors
ALTER TABLE complex_analysis_errors 
DROP CONSTRAINT IF EXISTS complex_analysis_errors_tier_name_check;

ALTER TABLE complex_analysis_errors
ADD CONSTRAINT complex_analysis_errors_tier_name_check 
CHECK (tier_name IS NULL OR tier_name = ANY (ARRAY['SMALL'::text, 'MEDIUM'::text, 'LARGE'::text, 'VERY_LARGE'::text, 'MASSIVE'::text, 'HIGH_LARGE'::text, 'ULTRA_LARGE'::text]));

-- 2. ATUALIZAR CONFIGURAÇÕES DE CHUNK SIZES

-- MEDIUM: 1001-2000 páginas → 400 páginas/chunk
UPDATE processing_tier_config
SET 
  chunk_size_pages = 400,
  max_parallel_chunks = 3,
  timeout_minutes = 20,
  consolidation_timeout_minutes = 35,
  estimated_duration_minutes = 90,
  requires_checkpointing = false,
  updated_at = now()
WHERE tier_name = 'MEDIUM';

-- LARGE: 2001-5000 páginas → 180 páginas/chunk
UPDATE processing_tier_config
SET 
  chunk_size_pages = 180,
  max_parallel_chunks = 4,
  timeout_minutes = 25,
  consolidation_timeout_minutes = 40,
  estimated_duration_minutes = 240,
  requires_checkpointing = true,
  updated_at = now()
WHERE tier_name = 'LARGE';

-- VERY_LARGE: 5001-10000 páginas → 180 páginas/chunk
UPDATE processing_tier_config
SET 
  chunk_size_pages = 180,
  max_parallel_chunks = 5,
  timeout_minutes = 30,
  consolidation_timeout_minutes = 45,
  estimated_duration_minutes = 420,
  requires_checkpointing = true,
  updated_at = now()
WHERE tier_name = 'VERY_LARGE';

-- 3. MIGRAR MASSIVE PARA HIGH_LARGE
UPDATE processing_tier_config
SET 
  tier_name = 'HIGH_LARGE',
  min_pages = 10001,
  max_pages = 20000,
  chunk_size_pages = 180,
  max_parallel_chunks = 5,
  timeout_minutes = 35,
  consolidation_timeout_minutes = 50,
  estimated_duration_minutes = 600,
  requires_checkpointing = true,
  subdivision_enabled = true,
  priority = 5,
  updated_at = now()
WHERE tier_name = 'MASSIVE';

-- Migrar processos existentes de MASSIVE para HIGH_LARGE
UPDATE processos
SET tier_name = 'HIGH_LARGE', updated_at = now()
WHERE tier_name = 'MASSIVE';

UPDATE process_chunks
SET tier_name = 'HIGH_LARGE'
WHERE tier_name = 'MASSIVE';

UPDATE complex_processing_status
SET tier_name = 'HIGH_LARGE'
WHERE tier_name = 'MASSIVE';

UPDATE complex_analysis_errors
SET tier_name = 'HIGH_LARGE'
WHERE tier_name = 'MASSIVE';

-- 4. CRIAR TIER ULTRA_LARGE
INSERT INTO processing_tier_config (
  tier_name,
  min_pages,
  max_pages,
  chunk_size_pages,
  max_parallel_chunks,
  timeout_minutes,
  consolidation_timeout_minutes,
  max_retries,
  priority,
  estimated_duration_minutes,
  requires_checkpointing,
  subdivision_enabled,
  active
) VALUES (
  'ULTRA_LARGE',
  20001,
  NULL,
  100,
  6,
  40,
  60,
  3,
  6,
  900,
  true,
  true,
  true
)
ON CONFLICT (tier_name) DO UPDATE SET
  min_pages = EXCLUDED.min_pages,
  max_pages = EXCLUDED.max_pages,
  chunk_size_pages = EXCLUDED.chunk_size_pages,
  max_parallel_chunks = EXCLUDED.max_parallel_chunks,
  timeout_minutes = EXCLUDED.timeout_minutes,
  consolidation_timeout_minutes = EXCLUDED.consolidation_timeout_minutes,
  max_retries = EXCLUDED.max_retries,
  priority = EXCLUDED.priority,
  estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
  requires_checkpointing = EXCLUDED.requires_checkpointing,
  subdivision_enabled = EXCLUDED.subdivision_enabled,
  active = EXCLUDED.active,
  updated_at = now();

-- 5. CRIAR FEATURE FLAGS
INSERT INTO feature_flags (flag_name, enabled, description)
VALUES 
  ('tier_system_high_large', true, 'Enable tier system for HIGH_LARGE files (10001-20000 pages)')
ON CONFLICT (flag_name) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description;

INSERT INTO feature_flags (flag_name, enabled, description)
VALUES 
  ('tier_system_ultra_large', true, 'Enable tier system for ULTRA_LARGE files (20001+ pages)')
ON CONFLICT (flag_name) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Verificar configurações finais
SELECT 
  tier_name,
  min_pages || '-' || COALESCE(max_pages::text, '∞') as page_range,
  chunk_size_pages as chunk_pages,
  max_parallel_chunks as parallel,
  timeout_minutes as timeout,
  priority,
  active
FROM processing_tier_config
ORDER BY min_pages;
