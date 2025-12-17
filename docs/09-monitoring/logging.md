# Sistema de Logs

Como logs são gerados e acessados no sistema.

## Frontend Logs

### Console Logging

```typescript
// utils/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  },

  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // Opcional: enviar para serviço de error tracking
  },

  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  }
};
```

### Uso

```typescript
try {
  await ProcessosService.create(data);
  logger.info('Processo created', { id });
} catch (error) {
  logger.error('Failed to create processo', error);
}
```

## Backend Logs (Edge Functions)

### Structured Logging

```typescript
// Edge Function
console.log(JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  function: 'start-analysis',
  processoId,
  message: 'Analysis started'
}));
```

### Acessar Logs

```bash
# Via Supabase CLI
supabase functions logs function-name

# Tail (tempo real)
supabase functions logs function-name --tail

# Com filtro
supabase functions logs function-name --tail | grep ERROR
```

### Via Dashboard

1. Supabase Dashboard
2. Edge Functions
3. Selecionar function
4. Tab "Logs"

## Database Logs

### Query Logs

Supabase Dashboard → Database → Logs

### Slow Queries

Supabase identifica queries lentas automaticamente.

## Log Levels

- **INFO** - Informações gerais
- **WARN** - Avisos (não críticos)
- **ERROR** - Erros que precisam atenção
- **DEBUG** - Debug (apenas em dev)

## Retention

- Frontend: Apenas runtime (console)
- Edge Functions: 7 dias (Supabase free tier)
- Database: 7 dias (Supabase free tier)

Para maior retenção: upgrade Supabase plan ou exportar logs.

---

[← Voltar ao Monitoring](./README.md)
