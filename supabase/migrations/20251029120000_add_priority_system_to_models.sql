/*
  # Adicionar Sistema de Prioridades aos Modelos LLM

  ## Resumo

  Transforma o sistema de modelo único em sistema multi-modelo com priorização
  e fallback automático entre modelos LLM.

  ## 1. Modificações na Tabela admin_system_models

  - Adiciona coluna `name` (text) - Nome amigável do modelo
  - Adiciona coluna `priority` (integer) - Ordem de prioridade para fallback (1 = maior prioridade)
  - Remove constraint de modelo único ativo
  - Adiciona constraint para garantir prioridades únicas
  - Atualiza dados existentes com valores padrão

  ## 2. Índices

  - Cria índice em `priority` para otimizar ordenação
  - Cria índice composto em (is_active, priority) para queries de fallback

  ## 3. Segurança

  - Mantém políticas RLS existentes

  ## 4. Dados Iniciais

  - Atualiza modelo existente com priority=1 e nome amigável
*/

-- =====================================================
-- ETAPA 1: Adicionar novas colunas
-- =====================================================

DO $$
BEGIN
  -- Adicionar coluna name se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'name'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN name text;
  END IF;

  -- Adicionar coluna priority se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_system_models'
    AND column_name = 'priority'
  ) THEN
    ALTER TABLE admin_system_models
    ADD COLUMN priority integer;
  END IF;
END $$;

-- =====================================================
-- ETAPA 2: Remover constraint de modelo único ativo
-- =====================================================

DROP INDEX IF EXISTS unique_active_model;

-- =====================================================
-- ETAPA 3: Atualizar dados existentes
-- =====================================================

-- Atualizar modelo existente com prioridade 1
UPDATE admin_system_models
SET
  name = COALESCE(name, 'Modelo Principal - ' || model_id),
  priority = COALESCE(priority, 1)
WHERE priority IS NULL OR name IS NULL;

-- =====================================================
-- ETAPA 4: Adicionar constraints
-- =====================================================

-- Tornar colunas NOT NULL após popular dados
ALTER TABLE admin_system_models
ALTER COLUMN name SET NOT NULL;

ALTER TABLE admin_system_models
ALTER COLUMN priority SET NOT NULL;

-- Adicionar constraint de prioridade única
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_model_priority'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT unique_model_priority UNIQUE (priority);
  END IF;
END $$;

-- Adicionar check constraint para garantir prioridade positiva
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_priority_positive'
  ) THEN
    ALTER TABLE admin_system_models
    ADD CONSTRAINT check_priority_positive CHECK (priority > 0);
  END IF;
END $$;

-- =====================================================
-- ETAPA 5: Criar índices para performance
-- =====================================================

-- Índice para ordenação por prioridade
CREATE INDEX IF NOT EXISTS idx_admin_system_models_priority
ON admin_system_models(priority ASC);

-- Índice composto para queries de fallback (modelos ativos por prioridade)
CREATE INDEX IF NOT EXISTS idx_admin_system_models_active_priority
ON admin_system_models(is_active, priority ASC)
WHERE is_active = true;

-- =====================================================
-- ETAPA 6: Comentários para documentação
-- =====================================================

COMMENT ON COLUMN admin_system_models.name IS
  'Nome amigável do modelo para exibição na interface';

COMMENT ON COLUMN admin_system_models.priority IS
  'Ordem de prioridade para fallback automático (1 = maior prioridade, usado primeiro)';

COMMENT ON COLUMN admin_system_models.is_active IS
  'Indica se o modelo está ativo e disponível para uso. Múltiplos modelos podem estar ativos simultaneamente.';
