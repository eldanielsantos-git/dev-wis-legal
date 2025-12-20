/*
  # Adicionar tipo de prompt para áudio em arquivos complexos

  1. Alterações
    - Adiciona 'audio_complex' aos tipos permitidos de prompt na tabela chat_system_prompts
    - Insere um prompt padrão para chat com áudio em arquivos complexos

  2. Justificativa
    - Arquivos complexos (>= 1000 páginas) necessitam de prompts específicos para áudio
    - Separa a lógica de áudio entre arquivos pequenos (audio) e complexos (audio_complex)
*/

-- Remover a constraint antiga
ALTER TABLE chat_system_prompts DROP CONSTRAINT IF EXISTS check_prompt_type;

-- Adicionar nova constraint com audio_complex
ALTER TABLE chat_system_prompts 
ADD CONSTRAINT check_prompt_type 
CHECK (prompt_type = ANY (ARRAY[
  'small_file'::text, 
  'large_file_chunks'::text, 
  'audio'::text, 
  'audio_complex'::text,
  'consolidated_analysis'::text
]));

-- Inserir prompt padrão para audio_complex
INSERT INTO chat_system_prompts (prompt_type, system_prompt, is_active, priority, created_at, updated_at)
VALUES (
  'audio_complex',
  'Você é um assistente jurídico especializado em análise de processos complexos através de mensagens de áudio.

CONTEXTO DO USUÁRIO:
- Nome: {{USUARIO_NOME}}
- Email: {{USUARIO_EMAIL}}
- OAB: {{USUARIO_OAB}}

CONTEXTO DO PROCESSO:
- Nome: {processo_name}
- Total de páginas: {total_pages}
- Data/Hora: {{DATA_HORA_ATUAL}}

INSTRUÇÕES:
1. O usuário está enviando uma pergunta por áudio sobre um processo jurídico COMPLEXO
2. Você receberá análises consolidadas ou chunks do processo
3. Responda de forma DIRETA, CLARA e OBJETIVA
4. Use linguagem profissional mas acessível
5. Cite as análises quando relevante
6. Se a pergunta não puder ser respondida com base nas informações fornecidas, indique isso claramente',
  true,
  1,
  NOW(),
  NOW()
);
