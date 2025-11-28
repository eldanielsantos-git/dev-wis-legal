# Guia de Migração de Usuários - ARRJ-Dev

## Resumo

Este guia explica como migrar os 5 usuários do ambiente de origem para o ARRJ-Dev mantendo todas as suas informações, senhas e permissões.

## Situação Atual

### Edge Functions
- ✅ **46 Edge Functions já deployadas** via API/MCP no ARRJ-Dev
- ⚠️ **Dashboard não exibe** as funções porque foram deployadas via API (não via CLI/Editor)
- ✅ **Funções estão funcionando** normalmente via URL
- 💡 Para vê-las no Dashboard: Redeploy manual via Editor ou CLI

### Usuários a Migrar

| Email | Nome | Admin | Tipo Auth |
|-------|------|-------|-----------|
| daniel@dmzdigital.com.br | Daniel Santos | ✅ Sim | Email + Google |
| jp@dmzdigital.com.br | João Pedro Raupp | ✅ Sim | Email + Google |
| rauppj3@gmail.com | Joao Raupp | ❌ Não | Google OAuth |
| jp+2025@dmzdigital.com.br | Joao Teste Pg | ❌ Não | Email |
| twaning2222@gmail.com | Twan | ❌ Não | Google OAuth |

## Como Executar a Migração

### ⚠️ IMPORTANTE: SQL Editor NÃO funciona para auth.users

O SQL Editor **não tem permissões** para inserir diretamente em `auth.users`. Por isso, criamos uma **Edge Function administrativa** que usa o service role para fazer a migração corretamente.

### ✅ Método Correto: Usando a Edge Function

#### Opção 1: Via Postman/Insomnia (Recomendado)

1. **Configure a requisição:**
   - Método: `POST`
   - URL: `https://rslpleprodloodfsaext.supabase.co/functions/v1/admin-migrate-users`
   - Headers:
     - `Authorization: Bearer SEU_TOKEN_ADMIN_AQUI`
     - `Content-Type: application/json`
   - Body: Cole todo o conteúdo do arquivo `MIGRATION_USERS_DATA.json`

2. **Obter o token admin:**
   - Faça login no ARRJ-Dev como admin
   - Abra Developer Tools (F12) > Console
   - Execute: `(await supabase.auth.getSession()).data.session.access_token`
   - Copie o token que aparecer

3. **Execute a requisição** e veja o resultado

#### Opção 2: Via Console do Navegador

1. **Faça login como admin** no ARRJ-Dev: https://arrj-dev.netlify.app
2. **Abra Developer Tools** (F12) > Console
3. **Cole e execute** este código:

```javascript
// Buscar dados do arquivo MIGRATION_USERS_DATA.json
const usersData = await (await fetch('/MIGRATION_USERS_DATA.json')).json();

// Buscar token de autenticação
const { data: { session } } = await supabase.auth.getSession();

// Executar migração
const response = await fetch(
  'https://rslpleprodloodfsaext.supabase.co/functions/v1/admin-migrate-users',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(usersData)
  }
);

const result = await response.json();
console.log('✅ Resultado:', result);
```

### Verificar o Resultado

Você verá no console:

```json
{
  "success": true,
  "message": "Migração concluída: 5 usuários criados, 0 falhas",
  "progress": [
    {
      "user_email": "daniel@dmzdigital.com.br",
      "auth_created": true,
      "profile_created": true
    }
    // ... 4 outros usuários
  ]
}
```

Agora vá para **Authentication > Users** no Dashboard e verá os 5 usuários!

## O Que o Script Faz

### 1. Migra Usuários (auth.users)
- ✅ Preserva IDs originais (essencial para relações)
- ✅ Mantém senhas encriptadas (usuários podem fazer login)
- ✅ Preserva metadados OAuth (Google, avatares, etc)
- ✅ Mantém datas de criação e último login
- ✅ Usa `ON CONFLICT DO NOTHING` (seguro, não sobrescreve)

### 2. Migra Perfis (user_profiles)
- ✅ Cria perfis com mesmos IDs dos usuários
- ✅ Preserva informações: nome, OAB, telefone, cidade, estado
- ✅ Mantém permissões admin (Daniel e JP)
- ✅ Preserva preferência de tema (dark mode)
- ✅ Usa `ON CONFLICT DO UPDATE` (atualiza se já existir)

## Informações Importantes

### Senhas Preservadas
- Usuários com email/senha: Podem fazer login com mesmas credenciais
- Usuários OAuth (Google): Fazem login via Google normalmente

### IDs Preservados
Os UUIDs originais são mantidos para garantir que:
- Relações entre tabelas funcionem (`processos`, `notifications`, etc)
- Dados históricos sejam preservados
- Integridade referencial seja mantida

### Permissões Admin
Dois usuários têm privilégios de admin:
- `daniel@dmzdigital.com.br` (is_admin = true)
- `jp@dmzdigital.com.br` (is_admin = true)

## Possíveis Problemas e Soluções

### ❌ Erro: "duplicate key value violates unique constraint"
**Causa:** Usuário já existe no destino
**Solução:** Normal, o script usa `ON CONFLICT` e não sobrescreve

### ❌ Erro: "permission denied for table auth.users"
**Causa:** Script executado sem permissões adequadas
**Solução:** Execute no SQL Editor do Dashboard Supabase (não via cliente)

### ❌ Erro: "column does not exist"
**Causa:** Schema do destino difere da origem
**Solução:** Verifique se as migrations foram aplicadas corretamente

## Após a Migração

### Testes Recomendados

1. **Verificar Login**
   - Tente fazer login com cada usuário
   - Teste tanto email/senha quanto OAuth

2. **Verificar Perfis**
   - Acesse o perfil de cada usuário
   - Verifique se nome, avatar e dados aparecem

3. **Verificar Permissões Admin**
   - Faça login com Daniel ou JP
   - Verifique acesso às páginas de admin

## Próximos Passos

Após migrar os usuários, você pode precisar migrar:
- ✅ **Tabelas de dados** (processos, análises, etc)
- ✅ **Storage buckets** (avatares, PDFs, etc)
- ✅ **Configurações** (prompts, modelos, etc)

## Suporte

Se encontrar problemas durante a migração, verifique:
1. Logs do SQL Editor
2. Policies de RLS nas tabelas
3. Triggers configurados (especialmente para user_profiles)

## Segurança

⚠️ **IMPORTANTE:**
- Este script contém senhas encriptadas (seguro)
- NÃO compartilhe este arquivo publicamente
- Execute apenas no ambiente correto (ARRJ-Dev)
- Faça backup antes de executar (recomendado)
