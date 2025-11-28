#!/bin/bash

# Script para deploy de todas as edge functions
PROJECT_REF="rslpleprodloodfsaext"

echo "🚀 Iniciando deploy de todas as Edge Functions..."
echo "📍 Projeto: $PROJECT_REF"
echo ""

# Array com todas as funções
FUNCTIONS=(
  "start-analysis"
  "process-next-prompt"
  "consolidation-worker"
  "upload-to-gemini"
  "create-upload-url"
  "chat-with-processo"
  "stripe-checkout"
  "stripe-webhook"
  "admin-delete-user"
  "cancel-subscription"
  "delete-user-account"
  "get-billing-analytics"
  "health-check-worker"
  "populate-pdf-base64"
  "process-audio-message"
  "process-complex-worker"
  "process-stuck-processos"
  "recover-stuck-processes"
  "restart-stage-manual"
  "retry-chunk-uploads"
  "send-friend-invite"
  "start-analysis-complex"
  "sync-stripe-coupons"
  "sync-stripe-extra-tokens"
  "sync-stripe-subscription"
  "update-user-password"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deployando: $func..."
  
  if supabase functions deploy $func --project-ref $PROJECT_REF; then
    echo "✅ $func deployado com sucesso"
    ((SUCCESS_COUNT++))
  else
    echo "❌ Falha ao deployar $func"
    ((FAIL_COUNT++))
    FAILED_FUNCTIONS+=("$func")
  fi
  
  echo ""
done

echo "================================================"
echo "📊 Resumo do Deploy"
echo "================================================"
echo "✅ Sucesso: $SUCCESS_COUNT funções"
echo "❌ Falhas: $FAIL_COUNT funções"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo "❌ Funções que falharam:"
  for failed in "${FAILED_FUNCTIONS[@]}"; do
    echo "  - $failed"
  done
  exit 1
else
  echo "🎉 Todas as funções foram deployadas com sucesso!"
  exit 0
fi
