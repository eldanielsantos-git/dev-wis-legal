/*
  # Atualizar Tags Padrão do Sistema

  1. Remove tags antigas
  2. Insere nova lista completa de tags padrão em ordem alfabética:
    - 1ª Instância
    - 2ª Instância
    - 3ª Instância
    - Anulado
    - Arquivado
    - Causa perdido
    - Em andamento
    - Encerrado
    - Ganho de Causa
    - Montar Parecer
    - Peticionar
    - Risco Alto
    - Risco Baixo
    - Risco Médio
*/

-- Remover tags antigas (apenas se não estiverem em uso)
DELETE FROM processo_tags WHERE name IN (
  'Em andamento',
  'Encerrado',
  'Ganho de causa',
  'Causa perdida',
  'Risco Alto',
  'Risco Médio',
  'Arquivado'
) AND usage_count = 0;

-- Inserir/atualizar tags padrão em ordem alfabética
INSERT INTO processo_tags (name, slug, color, description, display_order, created_at)
VALUES
  ('1ª Instância', '1a-instancia', '#6366F1', 'Processo tramitando na primeira instância', 1, NOW()),
  ('2ª Instância', '2a-instancia', '#8B5CF6', 'Processo tramitando na segunda instância', 2, NOW()),
  ('3ª Instância', '3a-instancia', '#A78BFA', 'Processo tramitando na terceira instância', 3, NOW()),
  ('Anulado', 'anulado', '#F97316', 'Processo anulado', 4, NOW()),
  ('Arquivado', 'arquivado', '#6B7280', 'Processo arquivado para consulta', 5, NOW()),
  ('Causa perdido', 'causa-perdido', '#EF4444', 'Processo com resultado desfavorável', 6, NOW()),
  ('Em andamento', 'em-andamento', '#3B82F6', 'Processo em tramitação ativa', 7, NOW()),
  ('Encerrado', 'encerrado', '#64748B', 'Processo finalizado', 8, NOW()),
  ('Ganho de Causa', 'ganho-de-causa', '#10B981', 'Processo com resultado favorável', 9, NOW()),
  ('Montar Parecer', 'montar-parecer', '#14B8A6', 'Necessário montar parecer', 10, NOW()),
  ('Peticionar', 'peticionar', '#06B6D4', 'Necessário peticionar', 11, NOW()),
  ('Risco Alto', 'risco-alto', '#DC2626', 'Processo com alto risco identificado', 12, NOW()),
  ('Risco Baixo', 'risco-baixo', '#84CC16', 'Processo com baixo risco identificado', 13, NOW()),
  ('Risco Médio', 'risco-medio', '#F59E0B', 'Processo com risco moderado', 14, NOW())
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;
