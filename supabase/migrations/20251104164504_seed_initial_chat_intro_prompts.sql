/*
  # Seed de Prompts de Introdução do Chat

  ## Resumo

  Insere os 8 prompts de introdução padrão que são exibidos aos usuários
  quando iniciam uma conversa no chat. Estes prompts foram migrados do
  código hardcoded para o banco de dados para permitir gerenciamento dinâmico.

  ## Prompts Inseridos

  1. Qual é o objeto principal desta ação?
  2. Quem são os advogados constituídos por cada uma das partes?
  3. Quais são os pontos fortes e fracos da tese do autor?
  4. Liste as últimas 5 movimentações processuais e suas datas.
  5. Há alguma audiência agendada? Se sim, quando e qual a sua finalidade?
  6. Quais provas foram produzidas pela parte autora e quais pela parte ré?
  7. Qual é o valor atualizado da causa?
  8. Qual é a fase processual atual e quais são as próximas etapas previstas?

  ## Observações

  - Todos os prompts são inseridos como ativos (is_active = true)
  - display_order define a ordem de exibição (1 a 8)
  - Se os prompts já existirem, não serão duplicados (ON CONFLICT DO NOTHING)
*/

-- Inserir os 8 prompts de introdução padrão
INSERT INTO chat_intro_prompts (prompt_text, display_order, is_active) VALUES
  ('Qual é o objeto principal desta ação?', 1, true),
  ('Quem são os advogados constituídos por cada uma das partes?', 2, true),
  ('Quais são os pontos fortes e fracos da tese do autor?', 3, true),
  ('Liste as últimas 5 movimentações processuais e suas datas.', 4, true),
  ('Há alguma audiência agendada? Se sim, quando e qual a sua finalidade?', 5, true),
  ('Quais provas foram produzidas pela parte autora e quais pela parte ré?', 6, true),
  ('Qual é o valor atualizado da causa?', 7, true),
  ('Qual é a fase processual atual e quais são as próximas etapas previstas?', 8, true)
ON CONFLICT DO NOTHING;
