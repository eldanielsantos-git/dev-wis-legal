#!/bin/bash

# Script para consolidar manualmente o processo 565e97f1-004e-4f4c-90fd-9f25c73cd1bd
# Todos os 63 chunks já foram processados, só falta a consolidação

PROCESSO_ID="565e97f1-004e-4f4c-90fd-9f25c73cd1bd"

# Verificar variáveis de ambiente
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Erro: Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidas"
  exit 1
fi

echo "🚀 Iniciando consolidação do processo ${PROCESSO_ID}"
echo "📋 9 prompts serão consolidados progressivamente"
echo ""

# Array com [prompt_id, nome]
declare -a PROMPTS=(
  "9065c2e6-5bf5-458f-88e8-0ab87ffe98bd|Visão Geral do Processo"
  "1b15497a-5bb4-4385-8cb0-490923233342|Resumo Estratégico"
  "73d1347a-328d-403f-8aa2-fa480b139b2e|Comunicações e Prazos"
  "0c384898-cd31-47c8-ab4a-c90a8334170d|Admissibilidade Recursal"
  "67f2e124-4f61-42e0-821d-bd4dadf8c453|Estratégias Jurídicas Recomendadas"
  "7cb0cecf-c501-4b27-930f-d1325df99ea6|Riscos e Alertas Processuais"
  "e008ca8f-f295-4ad7-8195-f24727a31802|Balanço Financeiro e Créditos Processuais"
  "89299276-b853-4ef5-b266-b90453fb870b|Mapa de Preclusões Processuais"
  "548de98c-ad25-4d9c-a7e9-ccdd40a02bb0|Conclusões e Perspectivas Processuais"
)

SUCCESS_COUNT=0
ERROR_COUNT=0

for PROMPT_ENTRY in "${PROMPTS[@]}"; do
  IFS='|' read -r PROMPT_ID PROMPT_NAME <<< "$PROMPT_ENTRY"

  echo "─────────────────────────────────────────────────────────"
  echo "🔄 [$((SUCCESS_COUNT + ERROR_COUNT + 1))/9] Consolidando: ${PROMPT_NAME}"
  echo "   ID: ${PROMPT_ID}"

  RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/consolidation-worker" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"processo_id\": \"${PROCESSO_ID}\", \"prompt_id\": \"${PROMPT_ID}\"}" \
    --max-time 180)

  HTTP_CODE=$?

  if [ $HTTP_CODE -eq 0 ]; then
    # Verificar se a resposta contém "success": true
    if echo "$RESPONSE" | grep -q '"success".*true'; then
      echo "   ✅ Consolidado com sucesso!"
      ((SUCCESS_COUNT++))
    else
      echo "   ⚠️  Resposta inesperada:"
      echo "   $RESPONSE" | head -c 200
      ((ERROR_COUNT++))
    fi
  else
    echo "   ❌ Erro na requisição (código: $HTTP_CODE)"
    echo "   $RESPONSE" | head -c 200
    ((ERROR_COUNT++))
  fi

  # Aguardar 3 segundos entre consolidações
  if [ $((SUCCESS_COUNT + ERROR_COUNT)) -lt 9 ]; then
    sleep 3
  fi
done

echo "─────────────────────────────────────────────────────────"
echo ""
echo "📊 Resumo:"
echo "   ✅ Sucessos: ${SUCCESS_COUNT}/9"
echo "   ❌ Erros:    ${ERROR_COUNT}/9"
echo ""

if [ $SUCCESS_COUNT -eq 9 ]; then
  echo "🎉 TODOS OS PROMPTS FORAM CONSOLIDADOS COM SUCESSO!"
  echo ""
  echo "Próximos passos:"
  echo "1. Verificar no frontend se os cards mostram conteúdo"
  echo "2. Verificar se o processo está marcado como 'completed'"
  echo "3. Testar com novo arquivo grande para validar fluxo automático"
elif [ $SUCCESS_COUNT -gt 0 ]; then
  echo "⚠️  CONSOLIDAÇÃO PARCIAL"
  echo ""
  echo "Alguns prompts foram consolidados, mas outros falharam."
  echo "Recomendações:"
  echo "1. Verificar logs da Edge Function consolidation-worker"
  echo "2. Verificar se há erro de schema (model_id vs current_model_id)"
  echo "3. Executar novamente este script para tentar os que falharam"
else
  echo "❌ CONSOLIDAÇÃO FALHOU COMPLETAMENTE"
  echo ""
  echo "Ações necessárias:"
  echo "1. Verificar se a Edge Function consolidation-worker foi deployada"
  echo "2. Verificar logs do Supabase para erros detalhados"
  echo "3. Confirmar que as variáveis de ambiente estão corretas"
fi

echo ""
echo "Para verificar o status no banco de dados:"
echo ""
echo "SELECT prompt_title, status, LENGTH(result_content) as content_length"
echo "FROM analysis_results"
echo "WHERE processo_id = '${PROCESSO_ID}'"
echo "ORDER BY execution_order;"
