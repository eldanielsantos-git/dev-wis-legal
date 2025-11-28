/*
# Criação do enum processo_status

1. Novo Enum
   - `processo_status` com valores: created, queuing, transcribing, completed, error

2. Descrição
   - created: Registro criado, aguardando início
   - queuing: Função "starter" está criando tarefas
   - transcribing: Worker está processando tarefas da fila
   - completed: Processo concluído com sucesso
   - error: Ocorreu um erro
*/

CREATE TYPE public.processo_status AS ENUM (
  'created',      -- Registro criado, aguardando início
  'queuing',      -- Função "starter" está criando tarefas
  'transcribing', -- Worker está processando tarefas da fila
  'completed',    -- Processo concluído com sucesso
  'error'         -- Ocorreu um erro
);