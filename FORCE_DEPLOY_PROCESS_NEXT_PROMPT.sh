#!/bin/bash

echo "🚀 FORCE DEPLOY: process-next-prompt"
echo "======================================"
echo ""

# Verificar se o arquivo existe
if [ ! -f "supabase/functions/process-next-prompt/index.ts" ]; then
  echo "❌ Arquivo não encontrado!"
  exit 1
fi

# Verificar se as validações estão no arquivo
if grep -q "VALIDAÇÃO CRÍTICA" supabase/functions/process-next-prompt/index.ts; then
  echo "✅ Validações encontradas no arquivo local"
else
  echo "❌ Validações NÃO encontradas no arquivo local!"
  exit 1
fi

echo ""
echo "📦 Fazendo deploy..."
echo ""

# Deploy forçado
supabase functions deploy process-next-prompt --no-verify-jwt

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "🔍 TESTE AGORA:"
echo "   1. Crie um novo processo grande (>1000 páginas)"
echo "   2. Verifique nos logs se aparece: '📄 Processando chunk X/Y (~600.000 tokens - SAFE)'"
echo "   3. Se NÃO aparecer, o deploy falhou novamente"
echo ""
