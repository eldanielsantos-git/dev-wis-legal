/*
  # Adicionar System Prompt aos Prompts de Análise

  1. Alterações na Tabela
    - Adiciona coluna `system_prompt` (TEXT) à tabela `analysis_prompts`
    - Este campo armazenará instruções fundamentais do sistema que serão enviadas como system_instruction para a LLM
    - Separa as responsabilidades:
      - `system_prompt`: Instruções gerais sobre o papel e comportamento da IA
      - `prompt_content`: Instruções específicas da tarefa de análise

  2. Benefícios
    - Melhor controle sobre o comportamento da LLM
    - Separação clara entre contexto do sistema e instruções da tarefa
    - Facilita ajustes sem modificar os prompts principais
    - Suporta o padrão system_instruction/user da API Gemini

  3. Uso
    - Na API Gemini: systemInstruction = system_prompt, contents = [{ role: 'user', parts: [prompt_content] }]
    - Permite definir personalidade, regras e diretrizes gerais uma vez
    - Cada prompt tem seu system_prompt customizado para sua função específica
*/

-- Adicionar coluna system_prompt
ALTER TABLE analysis_prompts
ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Comentário explicativo
COMMENT ON COLUMN analysis_prompts.system_prompt IS 
'Instruções fundamentais do sistema enviadas como system_instruction para a LLM. Define o papel, comportamento e diretrizes gerais da IA para esta análise específica.';