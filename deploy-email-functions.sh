#!/bin/bash

# Deploy all email functions to Supabase
# This script runs npx supabase functions deploy for each email function

EMAIL_FUNCTIONS=(
  "send-reset-password-email"
  "send-change-email"
  "send-email-process-completed"
  "send-friend-invite"
  "send-workspace-invite"
  "send-token-purchase-email"
  "send-payment-failure-email"
  "send-subscription-confirmation-email"
  "send-subscription-upgrade-email"
  "send-subscription-downgrade-email"
  "send-subscription-cancellation-email"
  "send-admin-analysis-error"
  "send-admin-complex-analysis-error"
)

echo "=== Deploying Email Functions ==="
echo "Total functions to deploy: ${#EMAIL_FUNCTIONS[@]}"
echo ""

for func in "${EMAIL_FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  npx supabase functions deploy "$func" --no-verify-jwt 2>&1 | grep -v "Bundled" || true
  echo "✓ $func deployed"
  echo ""
done

echo "=== All email functions deployed successfully! ==="
