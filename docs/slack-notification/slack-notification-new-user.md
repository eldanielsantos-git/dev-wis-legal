# 📱 Documentação Técnica: Padrão de Notificações Slack

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Fluxo](#arquitetura-e-fluxo)
3. [Credenciais e Segurança](#credenciais-e-segurança)
4. [⚠️ Regra de Ouro: Mobile Push vs Desktop Blocks](#regra-de-ouro-mobile-push-vs-desktop-blocks)
5. [Implementação Técnica](#implementação-técnica)
6. [Troubleshooting](#troubleshooting)
7. [🚀 Prompt de Replicação (No-Code)](#prompt-de-replicação-no-code)

---

## 🎯 Visão Geral

Este documento define o padrão arquitetural para notificações em tempo real via Slack no contexto de eventos de cadastro de usuários. A solução utiliza webhooks de banco de dados do Supabase, processamento serverless via Edge Functions, e integração com a API do Slack usando Block Kit.

**Casos de Uso:**
- ✅ Notificação de novo usuário cadastrado
- ✅ Alertas de eventos críticos do sistema
- ✅ Monitoramento de atividades administrativas

---

## 🏗️ Arquitetura e Fluxo

### Diagrama de Sequência

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌─────────┐
│  auth.users │      │   Database   │      │  Edge Function  │      │  Slack  │
│  (Supabase) │      │   Webhook    │      │   (Deno/TS)     │      │   API   │
└──────┬──────┘      └──────┬───────┘      └────────┬────────┘      └────┬────┘
       │                    │                       │                    │
       │ INSERT new user    │                       │                    │
       ├───────────────────>│                       │                    │
       │                    │                       │                    │
       │                    │ Trigger POST request  │                    │
       │                    ├──────────────────────>│                    │
       │                    │                       │                    │
       │                    │                       │ Processa dados     │
       │                    │                       │ + Formata payload  │
       │                    │                       │                    │
       │                    │                       │ POST chat.postMessage
       │                    │                       ├───────────────────>│
       │                    │                       │                    │
       │                    │                       │ ✅ 200 OK          │
       │                    │                       │<───────────────────┤
       │                    │                       │                    │
       │                    │ Response 200          │                    │
       │                    │<──────────────────────┤                    │
       │                    │                       │                    │
```

### Componentes da Arquitetura

#### 1. **Database Trigger/Webhook**
- **Tabela Monitorada:** `auth.users` ou `public.profiles`
- **Evento:** `INSERT` (novo registro criado)
- **Ação:** Dispara chamada HTTP POST para a Edge Function
- **Payload:** Dados do novo usuário (id, email, name, tipo, etc.)

#### 2. **Supabase Edge Function**
- **Runtime:** Deno (TypeScript)
- **Responsabilidades:**
  - Receber webhook do banco de dados
  - Validar e sanitizar dados de entrada
  - Formatar mensagem no padrão Slack Block Kit
  - **CRÍTICO:** Implementar lógica dual `text` + `blocks` (ver Regra de Ouro)
  - Enviar requisição para Slack API
  - Tratamento robusto de erros

#### 3. **Slack API**
- **Endpoint:** `https://slack.com/api/chat.postMessage`
- **Método:** POST
- **Autenticação:** Bearer Token (Bot User OAuth Token)
- **Content-Type:** `application/json`

---

## 🔐 Credenciais e Segurança

### Variáveis de Ambiente Obrigatórias

O projeto exige as seguintes credenciais configuradas no Supabase Dashboard (`Settings > Edge Functions > Secrets`):

| Variável | Descrição | Escopo | Exemplo |
|----------|-----------|--------|---------|
| `SLACK_BOT_TOKEN` | Token de autenticação do Bot do Slack | `chat:write`, `chat:write.public` | `xoxb-1234567890-...` |
| `SLACK_CHANNEL_ID` | ID do canal de destino | - | `C01ABC123XYZ` |

### Como Obter as Credenciais

#### 1. **SLACK_BOT_TOKEN**

1. Acesse [api.slack.com/apps](https://api.slack.com/apps)
2. Crie um novo App ou selecione um existente
3. No menu lateral, vá em **OAuth & Permissions**
4. Adicione os seguintes **Bot Token Scopes**:
   - `chat:write` (enviar mensagens como bot)
   - `chat:write.public` (enviar em canais públicos sem ser membro)
5. Clique em **Install to Workspace**
6. Copie o **Bot User OAuth Token** (começa com `xoxb-`)

#### 2. **SLACK_CHANNEL_ID**

1. Abra o Slack no navegador ou desktop app
2. Navegue até o canal desejado
3. Clique no nome do canal no topo
4. Na seção "About", role até o final
5. Copie o **Channel ID** (formato: `C01ABC123XYZ`)

### 🔒 Boas Práticas de Segurança

- ✅ **NUNCA** exponha tokens no código-fonte ou logs
- ✅ Use variáveis de ambiente do Supabase (criptografadas em repouso)
- ✅ Rotacione tokens periodicamente (recomendado: a cada 90 dias)
- ✅ Implemente rate limiting na Edge Function (evitar spam)
- ✅ Use `try/catch` robusto para evitar vazamento de erros sensíveis
- ✅ Valide origem da requisição (webhook signature, se possível)

---

## ⚠️ Regra de Ouro: Mobile Push vs Desktop Blocks

### 🚨 O Problema Crítico

**O Slack NÃO usa Block Kit para gerar o preview de notificação push no mobile.**

Se você enviar uma mensagem contendo apenas o campo `blocks`, o usuário verá:

```
📱 Notificação Mobile:
   [no preview available]
```

Isso acontece porque:
- **Mobile (iOS/Android/Watch):** O sistema de notificações push do SO usa o campo `text` como corpo da notificação.
- **Desktop/App:** A interface do Slack renderiza o `blocks` para experiência rica.

### ✅ A Solução Obrigatória

**Sempre enviar ambos os campos:**

1. **`text`** (string simples): "Resumo Executivo" para notificação push
2. **`blocks`** (array): Interface rica com Block Kit para desktop

### 📐 Padrão de Implementação

#### JSON de Exemplo Completo

```json
{
  "channel": "C01ABC123XYZ",
  "text": "✅ Novo Usuário | João Silva | joao@email.com",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "✅ Novo Registro Confirmado",
        "emoji": true
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Detalhes do Usuário:*\n• Nome: João Silva\n• Email: joao@email.com\n• Tipo: Pessoa Física\n• Cadastrado em: 2024-01-15 14:30"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "🕒 Notificação gerada automaticamente pelo sistema"
        }
      ]
    }
  ]
}
```

#### Resultado em Diferentes Plataformas

| Plataforma | Campo Usado | Visualização |
|------------|-------------|--------------|
| 📱 **Mobile Push** | `text` | `✅ Novo Usuário │ João Silva │ joao@email.com` |
| 💻 **Desktop App** | `blocks` | Interface rica com header, seções formatadas, dividers |
| ⌚ **Apple Watch** | `text` | `✅ Novo Usuário │ João Silva │ joao@email.com` |
| 🌐 **Web Browser** | `blocks` | Interface rica com header, seções formatadas, dividers |

### 🎯 Fórmula para o Campo `text`

O campo `text` deve seguir o padrão:

```
[Emoji Status] [Tipo de Evento] | [Identificador Principal] | [Info Complementar]
```

**Exemplos:**
- `✅ Novo Usuário | João Silva | joao@email.com`
- `⚠️ Erro Crítico | Processo #1234 | Token Limit Exceeded`
- `🎉 Pagamento Confirmado | R$ 299,00 | Cliente #5678`

### ⚡ Implementação em TypeScript

```typescript
// ❌ ERRADO - Sem campo text
await fetch('https://slack.com/api/chat.postMessage', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    channel: SLACK_CHANNEL_ID,
    blocks: [ /* ... */ ] // ⚠️ Mobile não mostra preview!
  })
});

// ✅ CORRETO - Com text + blocks
await fetch('https://slack.com/api/chat.postMessage', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    channel: SLACK_CHANNEL_ID,
    text: `✅ Novo Usuário | ${userName} | ${userEmail}`, // 📱 Para mobile
    blocks: [ /* ... */ ] // 💻 Para desktop
  })
});
```

---

## 🛠️ Implementação Técnica

### Estrutura da Edge Function

```typescript
// supabase/functions/send-admin-notification/index.ts

import { corsHeaders } from '../_shared/cors.ts';

interface NewUserPayload {
  id: string;
  email: string;
  name?: string;
  type?: 'PF' | 'PJ';
  created_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
    const SLACK_CHANNEL_ID = Deno.env.get('SLACK_CHANNEL_ID');

    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
      throw new Error('Credenciais Slack não configuradas');
    }

    const payload: NewUserPayload = await req.json();

    // 1. Criar campo text (resumo executivo para mobile)
    const textSummary = `✅ Novo Usuário | ${payload.name || 'N/A'} | ${payload.email}`;

    // 2. Criar blocks (interface rica para desktop)
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ Novo Registro Confirmado',
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Detalhes do Usuário:*\n• Nome: ${payload.name || 'N/A'}\n• Email: ${payload.email}\n• Tipo: ${payload.type || 'N/A'}\n• ID: \`${payload.id}\``
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🕒 ${new Date(payload.created_at).toLocaleString('pt-BR')}`
          }
        ]
      }
    ];

    // 3. Enviar para Slack (AMBOS os campos!)
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: SLACK_CHANNEL_ID,
        text: textSummary, // 📱 Mobile push
        blocks: blocks,    // 💻 Desktop interface
      })
    });

    const result = await slackResponse.json();

    if (!result.ok) {
      throw new Error(`Slack API Error: ${result.error}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Notificação enviada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao enviar notificação Slack:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### Configuração do Database Webhook

#### Opção 1: Via SQL Trigger (Recomendado)

```sql
-- Criar função que envia para Edge Function
CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload := json_build_object(
    'id', NEW.id,
    'email', NEW.email,
    'name', NEW.raw_user_meta_data->>'name',
    'type', NEW.raw_user_meta_data->>'type',
    'created_at', NEW.created_at
  );

  PERFORM net.http_post(
    url := 'https://[YOUR-PROJECT].supabase.co/functions/v1/send-admin-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '[YOUR-SERVICE-ROLE-KEY]'
    ),
    body := payload::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_user();
```

#### Opção 2: Via Supabase Webhooks (Dashboard)

1. Acesse Supabase Dashboard > Database > Webhooks
2. Crie novo webhook:
   - **Table:** `auth.users`
   - **Events:** `INSERT`
   - **Type:** HTTP Request
   - **URL:** `https://[YOUR-PROJECT].supabase.co/functions/v1/send-admin-notification`
   - **Method:** POST
   - **Headers:** `Authorization: Bearer [SERVICE-ROLE-KEY]`

---

## 🔍 Troubleshooting

### Problema: "[no preview available]" no mobile

**Causa:** Falta do campo `text` no payload.

**Solução:** Sempre incluir `text` junto com `blocks`:

```typescript
{
  text: "✅ Seu resumo aqui", // ← OBRIGATÓRIO
  blocks: [ /* ... */ ]
}
```

---

### Problema: Erro 401 Unauthorized

**Possíveis Causas:**
1. Token inválido ou expirado
2. Token não tem o escopo `chat:write`
3. Bot não foi instalado no workspace

**Solução:**
1. Verifique se o token começa com `xoxb-`
2. Revalide os escopos em OAuth & Permissions
3. Reinstale o app no workspace

---

### Problema: Erro 404 channel_not_found

**Possíveis Causas:**
1. Channel ID incorreto
2. Bot não tem acesso ao canal privado
3. Canal foi arquivado ou deletado

**Solução:**
1. Verifique o Channel ID (formato: `C01ABC123XYZ`)
2. Para canais privados: convide o bot manualmente
3. Use `chat:write.public` para canais públicos sem convite

---

### Problema: Edge Function timeout

**Possíveis Causas:**
1. Slack API lento
2. Bloqueio de rede/firewall
3. Payload muito grande

**Solução:**
1. Implemente retry exponencial
2. Use `AbortController` com timeout de 10s
3. Reduza tamanho dos blocks (máximo 50 blocos)

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(slackUrl, {
    signal: controller.signal,
    // ...
  });
} finally {
  clearTimeout(timeoutId);
}
```

---

## 🚀 Prompt de Replicação (No-Code)

### 📋 Copie e Cole Este Prompt em Qualquer Projeto

```
Você é um especialista em Supabase Edge Functions e integração com Slack.

Preciso implementar um sistema de notificações automáticas para o Slack quando um novo usuário se cadastrar no meu sistema.

REQUISITOS OBRIGATÓRIOS:

1. **Criar Edge Function no Supabase:**
   - Nome: `send-admin-notification`
   - Runtime: Deno/TypeScript
   - Recebe webhook do banco de dados quando um novo usuário é inserido em `auth.users`

2. **Integração com Slack API:**
   - Endpoint: `https://slack.com/api/chat.postMessage`
   - Método: POST
   - Autenticação: Bearer Token via variável `SLACK_BOT_TOKEN`
   - Canal de destino: variável `SLACK_CHANNEL_ID`

3. **CRÍTICO - Regra de Ouro do Mobile vs Desktop:**
   ⚠️ O Slack NÃO renderiza Block Kit em notificações push mobile!

   VOCÊ DEVE OBRIGATORIAMENTE implementar:

   a) Campo `text` (string simples) = "Resumo Executivo" para notificação push mobile
      Formato: "[Emoji] [Evento] | [Nome] | [Email]"
      Exemplo: "✅ Novo Usuário | João Silva | joao@email.com"

   b) Campo `blocks` (array) = Interface rica com Block Kit para desktop
      Use: header, section, divider, context
      Inclua: nome, email, tipo de usuário, timestamp

   ❌ NUNCA envie apenas `blocks` sem `text`!
   ✅ SEMPRE envie AMBOS os campos no payload JSON!

4. **Tratamento de Erros:**
   - Use `try/catch` robusto
   - Retorne status HTTP apropriado (200, 500)
   - Log detalhado de erros sem expor credenciais

5. **Variáveis de Ambiente:**
   - Solicite ao desenvolvedor configurar no Supabase:
     * `SLACK_BOT_TOKEN` (escopo: chat:write)
     * `SLACK_CHANNEL_ID`

6. **Exemplo de Payload Completo:**
```json
{
  "channel": "C01ABC123XYZ",
  "text": "✅ Novo Usuário | João Silva | joao@email.com",
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "✅ Novo Registro Confirmado"}
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Detalhes do Usuário:*\nNome: João Silva\nEmail: joao@email.com"
      }
    }
  ]
}
```

7. **Configuração do Database Trigger:**
   - Crie trigger SQL em `auth.users` (evento INSERT)
   - Use `net.http_post` do Supabase para chamar a Edge Function
   - Passe dados do usuário: id, email, name, created_at

RESULTADO ESPERADO:
- Notificação push mobile com texto legível (não "[no preview available]")
- Interface desktop rica com Block Kit
- Sistema robusto com tratamento de erros
- Documentação clara das variáveis de ambiente necessárias

Implemente essa solução completa agora.
```

---

## 📚 Recursos Adicionais

### Documentação Oficial
- [Slack Block Kit Builder](https://api.slack.com/block-kit/building) - Ferramenta visual para criar blocks
- [Slack API: chat.postMessage](https://api.slack.com/methods/chat.postMessage) - Referência da API
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions) - Guia completo
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks) - Configuração de triggers

### Ferramentas de Debug
- [Slack API Tester](https://api.slack.com/methods/chat.postMessage/test) - Teste requests manualmente
- [Block Kit Builder](https://app.slack.com/block-kit-builder/) - Preview de blocks em tempo real

---

## 📝 Changelog

| Data | Versão | Alterações |
|------|--------|-----------|
| 2024-01-28 | 1.0.0 | Documentação inicial criada |

---

**Autor:** Equipe de Arquitetura de Software
**Última Atualização:** 2024-01-28
**Status:** ✅ Produção
