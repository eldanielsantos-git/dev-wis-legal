/*
  # Populate Plan Benefits

  Inserts common benefits that are displayed across all subscription plans.
  These benefits can be managed dynamically through the admin interface.
*/

INSERT INTO subscription_plan_benefits (benefit_text, is_active, display_order)
VALUES
  ('Análise jurídica automatizada', true, 1),
  ('Extração de dados dos processos', true, 2),
  ('Geração de relatórios em DOCX', true, 3),
  ('Chat com IA sobre seus processos', true, 4),
  ('Suporte prioritário', true, 5),
  ('Atualizações automáticas', true, 6),
  ('Armazenamento seguro na nuvem', true, 7),
  ('Interface intuitiva e moderna', true, 8)
ON CONFLICT DO NOTHING;
