-- Index for forensic analysis status queries
CREATE INDEX IF NOT EXISTS idx_processos_forensic_lookup
  ON processos(forensic_analysis_status, updated_at DESC)
  WHERE forensic_analysis_status IS NOT NULL;

-- Partial index for active/processing records only
CREATE INDEX IF NOT EXISTS idx_processos_active
  ON processos(id, status, updated_at)
  WHERE status IN ('processing_batch', 'finalizing', 'processing_forensic');

-- Index for lock management queries
CREATE INDEX IF NOT EXISTS idx_processos_locks_active
  ON processos(id, finalization_lock_at, finalization_lock_heartbeat)
  WHERE finalization_lock_at IS NOT NULL;

-- Index for paginas retrieval by processo
CREATE INDEX IF NOT EXISTS idx_paginas_processo_page
  ON paginas(processo_id, page_number ASC);

-- Index for analise_forense lookups
CREATE INDEX IF NOT EXISTS idx_analise_forense_composite
  ON analise_forense(processo_id, created_at DESC);

-- Index for confidence score queries
CREATE INDEX IF NOT EXISTS idx_analise_forense_confidence
  ON analise_forense(confidence_score DESC, created_at DESC)
  WHERE confidence_score IS NOT NULL;