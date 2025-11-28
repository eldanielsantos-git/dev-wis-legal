#!/bin/bash

# Script para deployar todas as edge functions restantes
# Total: 22 funções

echo "🚀 Deployando 22 edge functions restantes..."
echo ""

# Lista de funções para deploy (excluindo as já deployadas e a muito grande)
FUNCTIONS=(
  "update-user-password"
  "retry-chunk-uploads"
  "sync-stripe-coupons"
  "populate-pdf-base64"
  "start-analysis"
  "health-check-worker"
  "recover-stuck-processes"
  "restart-stage-manual"
  "send-friend-invite"
  "sync-stripe-subscription"
  "start-analysis-complex"
  "download-all-storage"
  "consolidation-worker"
  "upload-to-gemini"
  "sync-stripe-extra-tokens"
  "process-audio-message"
  "chat-with-processo"
  "get-billing-analytics"
  "process-complex-worker"
  "stripe-webhook"
  "stripe-checkout"
)

TOTAL=${#FUNCTIONS[@]}
CURRENT=0
SUCCESS=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL] Deploying $func..."

  if supabase functions deploy "$func" --project-ref jpivqjbnnyjuqasfswka 2>&1; then
    SUCCESS=$((SUCCESS + 1))
    echo "✅ $func deployed successfully"
  else
    FAILED=$((FAILED + 1))
    echo "❌ $func failed to deploy"
  fi

  echo ""
done

echo "================================"
echo "📊 DEPLOYMENT SUMMARY"
echo "================================"
echo "Total functions: $TOTAL"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 All functions deployed successfully!"
else
  echo "⚠️  Some functions failed to deploy. Check the errors above."
fi

echo ""
echo "⚠️  MANUAL DEPLOYMENT REQUIRED:"
echo "   - process-next-prompt (1020 lines - too large for automated deployment)"
echo ""
