/*
  # Atualização dos Tipos de Prompts de Chat

  ## Resumo

  Atualiza constraint da tabela chat_system_prompts para aceitar 3 tipos:
  - small_file (Chat Padrão)
  - large_file_chunks (Chat Arquivos Grandes)
  - audio (Chat com Áudio)

  ## Mudanças

  1. Remove constraint antiga
  2. Cria nova constraint com os 3 tipos permitidos
  3. Atualiza comentários da tabela

  ## Tipos Permitidos

  - **small_file**: Chat padrão para processos com menos de 1000 páginas
  - **large_file_chunks**: Chat para processos com 1000+ páginas (usa chunks)
  - **audio**: Prompts específicos para mensagens de áudio

  ## Impacto

  - Edge functions devem usar apenas os 3 tipos permitidos
  - Interface admin mostrará 3 opções nos dropdowns
*/

-- =====================================================
-- 1. ATUALIZAR CONSTRAINT
-- =====================================================

-- Remove constraint antiga
ALTER TABLE chat_system_prompts
DROP CONSTRAINT IF EXISTS check_prompt_type;

-- Cria nova constraint permitindo 3 tipos
ALTER TABLE chat_system_prompts
ADD CONSTRAINT check_prompt_type CHECK (
  prompt_type IN ('small_file', 'large_file_chunks', 'audio')
);

-- =====================================================
-- 2. ATUALIZAR DOCUMENTAÇÃO
-- =====================================================

-- Atualiza comentário da coluna prompt_type
COMMENT ON COLUMN chat_system_prompts.prompt_type IS
'Tipo do prompt de chat. Valores permitidos:
- small_file: Chat padrão para processos com menos de 1000 páginas (usa transcrição/PDF base64)
- large_file_chunks: Chat para processos com 1000+ páginas (usa chunks como contexto)
- audio: Prompts específicos para mensagens de áudio no chat';

-- Atualiza comentário da tabela
COMMENT ON TABLE chat_system_prompts IS
'Armazena system prompts para o chat. Suporta 3 tipos: small_file (< 1000 páginas),
large_file_chunks (1000+ páginas), e audio (mensagens de áudio). Prompts são gerenciados
via interface admin e selecionados dinamicamente pela edge function.';

-- =====================================================
-- 3. VERIFICAÇÃO DE INTEGRIDADE
-- =====================================================

-- Verifica se existem prompts ativos para cada tipo
DO $$
DECLARE
  small_file_count INTEGER;
  large_file_chunks_count INTEGER;
  audio_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO small_file_count
  FROM chat_system_prompts
  WHERE prompt_type = 'small_file' AND is_active = true;

  SELECT COUNT(*) INTO large_file_chunks_count
  FROM chat_system_prompts
  WHERE prompt_type = 'large_file_chunks' AND is_active = true;

  SELECT COUNT(*) INTO audio_count
  FROM chat_system_prompts
  WHERE prompt_type = 'audio' AND is_active = true;

  RAISE NOTICE '✓ Prompts ativos: small_file (%), large_file_chunks (%), audio (%)',
    small_file_count, large_file_chunks_count, audio_count;

  IF small_file_count = 0 THEN
    RAISE WARNING '⚠ Não há prompt ativo para small_file';
  END IF;

  IF large_file_chunks_count = 0 THEN
    RAISE WARNING '⚠ Não há prompt ativo para large_file_chunks';
  END IF;

  IF audio_count = 0 THEN
    RAISE WARNING '⚠ Não há prompt ativo para audio';
  END IF;
END $$;
