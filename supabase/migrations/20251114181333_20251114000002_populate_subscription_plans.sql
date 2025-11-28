/*
  # Populate Subscription Plans

  Inserts the four existing subscription plans with their correct Stripe Price IDs and tokens.

  Plans:
  - Essencial: R$ 59,00 / 1.2M tokens
  - Premium: R$ 159,00 / 4M tokens
  - Pro: R$ 309,00 / 8M tokens
  - Elite: R$ 759,00 / 20M tokens
*/

INSERT INTO subscription_plans (name, description, stripe_price_id, price_brl, tokens_included, is_active, display_order)
VALUES
  (
    'Essencial',
    'Plano ideal para quem está começando',
    'price_1SG3zEJrr43cGTt4oUj89h9u',
    59.00,
    1200000,
    true,
    1
  ),
  (
    'Premium',
    'Para profissionais que precisam de mais recursos',
    'price_1SG40ZJrr43cGTt4SGCX0JUZ',
    159.00,
    4000000,
    true,
    2
  ),
  (
    'Pro',
    'Solução completa para escritórios médios',
    'price_1SG41xJrr43cGTt4MQwqdEiv',
    309.00,
    8000000,
    true,
    3
  ),
  (
    'Elite',
    'Máximo poder para grandes operações',
    'price_1SG43JJrr43cGTt4URQn0TxZ',
    759.00,
    20000000,
    true,
    4
  )
ON CONFLICT (stripe_price_id) DO NOTHING;
