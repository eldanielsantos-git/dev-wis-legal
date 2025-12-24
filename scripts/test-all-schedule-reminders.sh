#!/bin/bash

# Script para testar envio de lembretes de schedule para TODOS os usuários
# Simula a execução do cron job diário

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Teste de Envio de Lembretes de Schedule (Todos os Usuários) ===${NC}\n"

# Carrega variáveis do .env
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo -e "${RED}Erro: Arquivo .env não encontrado${NC}"
  exit 1
fi

# Verifica variáveis necessárias
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados${NC}"
  exit 1
fi

TODAY=$(date +%Y-%m-%d)
echo -e "${YELLOW}Data de processamento: ${TODAY}${NC}\n"

# Envia o email para todos os usuários
echo -e "${YELLOW}Enviando lembretes para todos os usuários com deadlines hoje...${NC}\n"

RESPONSE=$(curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -w "\n%{http_code}" \
  "${SUPABASE_URL}/functions/v1/send-daily-schedule-reminders" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "Response code: ${HTTP_CODE}"
echo -e "Response body:\n${BODY}\n"

if [ "$HTTP_CODE" -eq 200 ]; then
  SUCCESS=$(echo "$BODY" | jq -r '.success // false')
  if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Processamento concluído com sucesso!${NC}\n"

    TOTAL=$(echo "$BODY" | jq -r '.results.total_users // 0')
    SUCCESS_COUNT=$(echo "$BODY" | jq -r '.results.success // 0')
    FAILED=$(echo "$BODY" | jq -r '.results.failed // 0')
    SKIPPED=$(echo "$BODY" | jq -r '.results.skipped // 0')

    echo -e "${GREEN}Resumo:${NC}"
    echo -e "  Total de usuários: ${TOTAL}"
    echo -e "  ${GREEN}Sucesso: ${SUCCESS_COUNT}${NC}"
    echo -e "  ${RED}Falhas: ${FAILED}${NC}"
    echo -e "  ${YELLOW}Ignorados: ${SKIPPED}${NC}"

    if [ "$FAILED" -gt 0 ]; then
      echo -e "\n${RED}Erros:${NC}"
      echo "$BODY" | jq -r '.results.errors[]' | while read -r error; do
        echo -e "  - ${error}"
      done
    fi
  else
    MESSAGE=$(echo "$BODY" | jq -r '.message // "Unknown error"')
    echo -e "${YELLOW}⊘ ${MESSAGE}${NC}"
  fi
else
  echo -e "${RED}✗ Falha no processamento${NC}"
  ERROR=$(echo "$BODY" | jq -r '.error // "Unknown error"')
  echo -e "Erro: ${ERROR}"
  exit 1
fi

echo -e "\n${GREEN}=== Teste concluído ===${NC}"
