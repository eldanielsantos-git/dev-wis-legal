#!/bin/bash

# Script para testar envio de lembretes de schedule
# Para testar com um usuário específico

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Teste de Envio de Lembrete de Schedule ===${NC}\n"

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

# Busca o user_id do daniel@dmzdigital.com.br
echo -e "${YELLOW}Buscando user_id de daniel@dmzdigital.com.br...${NC}"

USER_EMAIL="daniel@dmzdigital.com.br"

USER_ID=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email_input\": \"${USER_EMAIL}\"}" | jq -r '.')

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  # Tenta buscar direto da tabela user_profiles
  USER_ID=$(curl -s "${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${USER_EMAIL}&select=id" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | jq -r '.[0].id // empty')
fi

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo -e "${RED}Erro: Usuário não encontrado${NC}"
  exit 1
fi

echo -e "${GREEN}User ID encontrado: ${USER_ID}${NC}\n"

# Verifica se existem deadlines para hoje
echo -e "${YELLOW}Verificando deadlines para hoje...${NC}"
TODAY=$(date +%Y-%m-%d)

DEADLINES=$(curl -s "${SUPABASE_URL}/rest/v1/process_deadlines?user_id=eq.${USER_ID}&deadline_date=eq.${TODAY}&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

DEADLINES_COUNT=$(echo "$DEADLINES" | jq '. | length')

if [ "$DEADLINES_COUNT" -eq 0 ]; then
  echo -e "${RED}Nenhum deadline encontrado para hoje (${TODAY})${NC}"
  echo -e "${YELLOW}Dica: Crie um deadline para hoje usando a interface da aplicação${NC}"
  exit 1
fi

echo -e "${GREEN}Encontrados ${DEADLINES_COUNT} deadline(s) para hoje${NC}\n"

# Envia o email de teste
echo -e "${YELLOW}Enviando email de teste...${NC}\n"

RESPONSE=$(curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -w "\n%{http_code}" \
  "${SUPABASE_URL}/functions/v1/send-schedule-day" \
  -d "{\"user_id\": \"${USER_ID}\", \"date\": \"${TODAY}\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo -e "Response code: ${HTTP_CODE}"
echo -e "Response body: ${BODY}\n"

if [ "$HTTP_CODE" -eq 200 ]; then
  SUCCESS=$(echo "$BODY" | jq -r '.success // false')
  if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Email enviado com sucesso!${NC}"
    RESEND_ID=$(echo "$BODY" | jq -r '.resend_id // "N/A"')
    EVENTS_COUNT=$(echo "$BODY" | jq -r '.events_count // 0')
    echo -e "Resend ID: ${RESEND_ID}"
    echo -e "Eventos: ${EVENTS_COUNT}"
  else
    MESSAGE=$(echo "$BODY" | jq -r '.message // "Unknown error"')
    echo -e "${YELLOW}⊘ ${MESSAGE}${NC}"
  fi
else
  echo -e "${RED}✗ Falha ao enviar email${NC}"
  ERROR=$(echo "$BODY" | jq -r '.error // "Unknown error"')
  echo -e "Erro: ${ERROR}"
  exit 1
fi

echo -e "\n${GREEN}=== Teste concluído ===${NC}"
