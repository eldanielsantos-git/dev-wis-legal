# Template Resend - Alerta de Limite de Tokens

## 📧 Informações dos Templates

### Templates Configurados

O sistema utiliza **2 templates distintos** no Resend:

#### 1. Alerta de 75% de Uso
- **Nome do Template:** `tokens-running-out-75`
- **Template ID:** `e4674548-2538-491e-800d-28cd09a46db1`
- **Quando dispara:** Quando o uso atinge ou ultrapassa 75%
- **Tom:** Aviso preventivo

#### 2. Alerta de 100% de Uso (Tokens Esgotados)
- **Nome do Template:** `tokens-running-out-100`
- **Template ID:** `c542e537-4176-4cdb-be3d-71fde95aaeb1`
- **Quando dispara:** Quando o uso atinge ou ultrapassa 100%
- **Tom:** Crítico

---

## 🔧 Variáveis dos Templates

Ambos os templates devem conter as mesmas 8 variáveis:

| Variável | Tipo | Descrição | Exemplo |
|----------|------|-----------|---------|
| `first_name` | String | Primeiro nome do usuário | "João" |
| `total_tokens` | String | Total de tokens disponíveis (formatado) | "50.000" |
| `used_tokens` | String | Tokens já utilizados (formatado) | "37.500" |
| `remaining_tokens` | String | Tokens ainda disponíveis (formatado) | "12.500" |
| `percentage_used` | String | Porcentagem usada | "75%" ou "100%" |
| `view_plans_url` | String | URL para página de planos de assinatura | "https://app.wislegal.io/subscription" |
| `view_token_packages_url` | String | URL para página de pacotes de tokens | "https://app.wislegal.io/tokens" |
| `reset_date` | String | Data de renovação dos tokens | "01/01/2025" |

---

## 📝 Exemplo de Template HTML

### Template para 75% (tokens-running-out-75)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Tokens</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <!-- Header -->
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://app.wislegal.io/logo.png" alt="WisLegal" style="height: 50px;">
  </div>

  <!-- Título -->
  <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 10px;">
    ⚠️ Seus tokens estão chegando ao fim!
  </h1>

  <!-- Saudação -->
  <p style="font-size: 16px; margin-bottom: 20px;">
    Olá <strong>{{first_name}}</strong>,
  </p>

  <!-- Alerta Principal -->
  <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
    <p style="margin: 0; font-size: 16px;">
      Você consumiu <strong style="color: #f59e0b;">{{percentage_used}}</strong> do seu total de
      <strong>{{total_tokens}}</strong> tokens.
    </p>
  </div>

  <!-- Detalhes de Uso -->
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
    <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Resumo de Uso</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tokens Totais:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{total_tokens}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tokens Usados:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #f59e0b;">{{used_tokens}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">Tokens Restantes:</td>
        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">{{remaining_tokens}}</td>
      </tr>
    </table>
    <p style="margin-top: 15px; margin-bottom: 0; font-size: 14px; color: #6b7280;">
      Renovação em: <strong>{{reset_date}}</strong>
    </p>
  </div>

  <!-- Call to Action - Planos de Assinatura -->
  <div style="margin-bottom: 20px;">
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">💎 Planos de Assinatura</h3>
    <p style="margin-bottom: 15px; color: #6b7280;">
      Conheça planos de assinatura que permitem uma capacidade maior de análises.
    </p>
    <a href="{{view_plans_url}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      Ver Planos de Assinatura
    </a>
  </div>

  <!-- Call to Action - Pacotes de Tokens -->
  <div style="margin-bottom: 30px;">
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">🎯 Pacotes de Tokens</h3>
    <p style="margin-bottom: 15px; color: #6b7280;">
      Se desejar, também pode comprar tokens avulsos em um de nossos pacotes.
    </p>
    <a href="{{view_token_packages_url}}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      Ver Pacotes de Tokens
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px;">
    <p style="margin: 5px 0;">Obrigado por usar o WisLegal!</p>
    <p style="margin: 5px 0;">
      © 2024 WisLegal. Todos os direitos reservados.
    </p>
  </div>

</body>
</html>
```

### Template para 100% (tokens-running-out-100)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seus Tokens Acabaram</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <!-- Header -->
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="https://app.wislegal.io/logo.png" alt="WisLegal" style="height: 50px;">
  </div>

  <!-- Título -->
  <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 10px;">
    🚨 Seus tokens acabaram!
  </h1>

  <!-- Saudação -->
  <p style="font-size: 16px; margin-bottom: 20px;">
    Olá <strong>{{first_name}}</strong>,
  </p>

  <!-- Alerta Principal -->
  <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
    <p style="margin: 0; font-size: 16px;">
      Você consumiu <strong style="color: #dc2626;">{{percentage_used}}</strong> do seu total de
      <strong>{{total_tokens}}</strong> tokens.
    </p>
    <p style="margin: 10px 0 0 0; font-size: 15px; color: #991b1b;">
      <strong>Você não pode mais realizar análises até renovar seus tokens.</strong>
    </p>
  </div>

  <!-- Detalhes de Uso -->
  <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
    <h3 style="margin-top: 0; color: #1f2937; font-size: 18px;">Resumo de Uso</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tokens Totais:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">{{total_tokens}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tokens Usados:</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">{{used_tokens}}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">Tokens Restantes:</td>
        <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc2626;">{{remaining_tokens}}</td>
      </tr>
    </table>
    <p style="margin-top: 15px; margin-bottom: 0; font-size: 14px; color: #6b7280;">
      Renovação em: <strong>{{reset_date}}</strong>
    </p>
  </div>

  <!-- Call to Action - Planos de Assinatura -->
  <div style="margin-bottom: 20px;">
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">💎 Planos de Assinatura</h3>
    <p style="margin-bottom: 15px; color: #6b7280;">
      Faça upgrade para um plano superior e continue usando a plataforma sem interrupções.
    </p>
    <a href="{{view_plans_url}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      Ver Planos de Assinatura
    </a>
  </div>

  <!-- Call to Action - Pacotes de Tokens -->
  <div style="margin-bottom: 30px;">
    <h3 style="color: #1f2937; font-size: 18px; margin-bottom: 10px;">🎯 Pacotes de Tokens</h3>
    <p style="margin-bottom: 15px; color: #6b7280;">
      Ou compre um pacote avulso de tokens para continuar imediatamente.
    </p>
    <a href="{{view_token_packages_url}}" style="display: inline-block; background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
      Comprar Tokens Agora
    </a>
  </div>

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #6b7280; font-size: 14px;">
    <p style="margin: 5px 0;">Obrigado por usar o WisLegal!</p>
    <p style="margin: 5px 0;">
      © 2024 WisLegal. Todos os direitos reservados.
    </p>
  </div>

</body>
</html>
```

---

## 🎨 Níveis de Alerta

O sistema dispara 2 níveis diferentes de alerta:

### 75% de Uso (Alerta Preventivo)
- **Tipo:** `75_percent`
- **Template:** `tokens-running-out-75`
- **Template ID:** `e4674548-2538-491e-800d-28cd09a46db1`
- **Cor:** Amarelo/Laranja (#f59e0b)
- **Mensagem:** "Seus tokens estão chegando ao fim!"
- **Tom:** Aviso preventivo, convidativo

### 100% de Uso (Alerta Crítico)
- **Tipo:** `100_percent`
- **Template:** `tokens-running-out-100`
- **Template ID:** `c542e537-4176-4cdb-be3d-71fde95aaeb1`
- **Cor:** Vermelho (#dc2626)
- **Mensagem:** "Seus tokens acabaram!"
- **Tom:** Crítico, urgente

**Nota:** O sistema sempre dispara o alerta do nível mais alto atingido. Se o usuário atingir 100% sem ter recebido o alerta de 75%, receberá diretamente o alerta de 100%.

---

## ⚙️ Configuração no Resend

Os templates devem ser configurados no Resend com os seguintes dados:

### Template 75%
- **Template Name:** `tokens-running-out-75`
- **Template ID:** `e4674548-2538-491e-800d-28cd09a46db1`
- **Subject:** `Alerta: Seus tokens estão chegando ao fim ({{percentage_used}} usado)`
- **From:** `WisLegal <noreply@wislegal.io>`

### Template 100%
- **Template Name:** `tokens-running-out-100`
- **Template ID:** `c542e537-4176-4cdb-be3d-71fde95aaeb1`
- **Subject:** `Alerta: Seus tokens acabaram! ({{percentage_used}} usado)`
- **From:** `WisLegal <noreply@wislegal.io>`

Ambos os templates devem incluir todas as 8 variáveis listadas acima para funcionar corretamente.

---

## 🚀 Como Funciona

### Disparo Automático

O sistema monitora automaticamente o uso de tokens e dispara emails quando:

1. **Tokens atingem 75%** → Email de alerta preventivo (template 75%)
2. **Tokens atingem 100%** → Email de alerta crítico (template 100%)

### Proteção Anti-Spam

- Cada tipo de notificação só é enviado **1 vez a cada 7 dias**
- Evita múltiplos emails para o mesmo usuário
- Registra todas as notificações no banco de dados

### Trigger Automático

- Dispara **automaticamente** quando `tokens_used` é atualizado em `stripe_subscriptions`
- Não requer chamada manual
- Funciona em tempo real

---

## 🔍 Monitoramento

### Consultar notificações enviadas

```sql
SELECT
  u.email,
  u.name,
  tln.notification_type,
  tln.tokens_total,
  tln.tokens_used,
  tln.percentage_used,
  tln.email_sent,
  tln.email_sent_at,
  tln.created_at
FROM token_limit_notifications tln
JOIN users u ON u.id = tln.user_id
ORDER BY tln.created_at DESC
LIMIT 20;
```

### Consultar notificações pendentes (falhas)

```sql
SELECT
  u.email,
  u.name,
  tln.notification_type,
  tln.tokens_used || '/' || tln.tokens_total as usage,
  tln.percentage_used || '%' as percentage,
  tln.created_at
FROM token_limit_notifications tln
JOIN users u ON u.id = tln.user_id
WHERE tln.email_sent = false
ORDER BY tln.created_at DESC;
```

---

## 🧪 Teste Manual

Para testar o envio de email manualmente:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-tokens-limit \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "uuid-do-usuario-aqui"}'
```

---

## 📊 Métricas de Sucesso

A função registra automaticamente:
- ✅ Emails enviados com sucesso
- ❌ Falhas no envio
- 📅 Data e hora de cada notificação
- 📈 Uso de tokens no momento do alerta
- 🎯 Tipo de alerta disparado

---

## ⚠️ Notas Importantes

1. **Ambiente de Produção**: A função funciona automaticamente em produção
2. **Resend API Key**: Já configurada no Supabase
3. **Template IDs**:
   - 75%: `e4674548-2538-491e-800d-28cd09a46db1`
   - 100%: `c542e537-4176-4cdb-be3d-71fde95aaeb1`
4. **Variáveis**: Todas as 8 variáveis devem estar presentes em ambos os templates
5. **Anti-Spam**: Máximo de 1 email por tipo de alerta a cada 7 dias

---

## 📞 Suporte

Se tiver dúvidas sobre a configuração dos templates, consulte a [documentação do Resend](https://resend.com/docs/send-with-templates).
