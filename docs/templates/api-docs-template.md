# API: [Nome da API/Edge Function]

> Template para documentação de APIs e Edge Functions

## Visão Geral

**Endpoint:** `[METHOD] /functions/v1/function-name`
**Descrição:** [Breve descrição do que a API faz]
**Versão:** [x.y.z]
**Autenticação:** [Required/Optional/None]

## Autenticação

### Tipo
- [ ] Bearer Token (User)
- [ ] Service Role
- [ ] Webhook Signature
- [ ] Public (sem auth)

### Headers
```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Request

### Method
`[GET/POST/PUT/DELETE]`

### URL
```
https://[project-id].supabase.co/functions/v1/function-name
```

### Path Parameters
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `id` | string | Sim | [Descrição] |

### Query Parameters
| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `page` | number | Não | 1 | [Descrição] |
| `limit` | number | Não | 10 | [Descrição] |

### Request Body
```typescript
interface RequestBody {
  field1: string;
  field2: number;
  field3?: boolean;
}
```

### Exemplo de Request
```bash
curl -X POST \
  https://[project-id].supabase.co/functions/v1/function-name \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "field1": "value1",
    "field2": 123
  }'
```

```typescript
// TypeScript/JavaScript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/function-name`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field1: 'value1',
      field2: 123,
    }),
  }
);

const data = await response.json();
```

## Response

### Success Response

**Status Code:** `200 OK`

```typescript
interface SuccessResponse {
  success: true;
  data: {
    id: string;
    field1: string;
    field2: number;
  };
}
```

### Exemplo de Response
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "field1": "value1",
    "field2": 123
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Invalid request body",
    "code": "INVALID_REQUEST"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Authentication required",
    "code": "UNAUTHORIZED"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions",
    "code": "FORBIDDEN"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Resource not found",
    "code": "NOT_FOUND"
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "message": "Internal server error",
    "code": "INTERNAL_ERROR"
  }
}
```

## Error Codes

| Code | HTTP Status | Descrição |
|------|-------------|-----------|
| `INVALID_REQUEST` | 400 | Request inválido |
| `UNAUTHORIZED` | 401 | Não autenticado |
| `FORBIDDEN` | 403 | Sem permissão |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `INTERNAL_ERROR` | 500 | Erro interno |

## Rate Limiting

- **Limite:** [X requests por minuto/hora]
- **Header de rate limit:** `X-RateLimit-Remaining`
- **Comportamento ao exceder:** [Descrição]

## Validações

### Request Validation
- `field1` - [Validações específicas]
- `field2` - [Validações específicas]

### Business Logic Validation
- [Regra de negócio 1]
- [Regra de negócio 2]

## Side Effects

### Database Changes
- Tabela `table_name` - [Tipo de operação]

### External API Calls
- [Nome da API externa] - [Por que é chamada]

### Notifications
- Email enviado para [quem]
- Push notification para [quem]

## Performance

### Tempo de Resposta
- **Média:** [X ms]
- **P95:** [X ms]
- **P99:** [X ms]

### Complexidade
- **Database queries:** [Número]
- **External API calls:** [Número]

## Testes

### Unit Tests
```typescript
// Exemplo de teste
describe('function-name', () => {
  it('should do X when Y', async () => {
    // Test implementation
  });
});
```

### Integration Tests
- [ ] Teste de fluxo completo
- [ ] Teste de erro handling
- [ ] Teste de autenticação

### Manual Tests
```bash
# Teste manual
curl -X POST ...
```

## Dependências

### Services
- Supabase Database
- Google Gemini API
- Stripe API

### Environment Variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

## Changelog

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0.0 | YYYY-MM-DD | Versão inicial |
| 1.1.0 | YYYY-MM-DD | Adicionado campo X |

## Links Relacionados

- [Documentação relacionada]
- [Issue #XXX]
- [PR #YYY]

---

**Última Atualização:** [YYYY-MM-DD]
**Maintainer:** [Nome]
