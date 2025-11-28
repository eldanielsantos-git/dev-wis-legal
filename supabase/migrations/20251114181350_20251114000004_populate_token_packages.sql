/*
  # Populate Token Packages

  Inserts token packages available for one-time purchase.
  These provide extra tokens on top of subscription allocations.

  Packages:
  - 2.000.000 tokens: R$ 70,00
  - 5.000.000 tokens: R$ 150,00
*/

INSERT INTO token_packages (name, description, stripe_price_id, price_brl, tokens_amount, is_active, display_order)
VALUES
  (
    '2M Tokens',
    'Pacote adicional de 2 milhões de tokens',
    'price_1SG44PJrr43cGTt4SX4jYSaB',
    70.00,
    2000000,
    true,
    1
  ),
  (
    '5M Tokens',
    'Pacote adicional de 5 milhões de tokens',
    'price_1SG45HJrr43cGTt4sP0VfNsz',
    150.00,
    5000000,
    true,
    2
  )
ON CONFLICT (stripe_price_id) DO NOTHING;
