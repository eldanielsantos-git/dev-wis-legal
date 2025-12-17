# Padrões e Convenções

Padrões de código e convenções usadas no projeto.

## Índice

- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Naming Conventions](#naming-conventions)
- [Padrões React](#padrões-react)
- [Padrões de Serviços](#padrões-de-serviços)
- [Padrões Edge Functions](#padrões-edge-functions)
- [Tratamento de Erros](#tratamento-de-erros)
- [TypeScript](#typescript)
- [Testes](#testes)

---

## Estrutura de Arquivos

### Frontend

```
src/
├── components/           # Componentes React reutilizáveis
│   ├── ComponentName.tsx
│   ├── analysis-views/  # Grupo de componentes relacionados
│   ├── subscription/
│   └── tags/
│
├── pages/               # Componentes de página (rotas)
│   └── PageName.tsx
│
├── contexts/            # React Contexts
│   └── ContextName.tsx
│
├── hooks/               # Custom hooks
│   └── useHookName.ts
│
├── services/            # Serviços de API
│   └── ServiceName.ts
│
├── utils/               # Funções utilitárias
│   └── utilName.ts
│
├── types/               # TypeScript types
│   └── typeName.ts
│
└── lib/                 # Configuração de libs externas
    ├── supabase.ts
    └── gemini.ts
```

### Backend

```
supabase/
├── functions/           # Edge Functions
│   ├── function-name/
│   │   └── index.ts
│   └── _shared/        # Código compartilhado
│       └── cors.ts
│
└── migrations/          # Database migrations
    └── YYYYMMDDHHMMSS_description.sql
```

---

## Naming Conventions

### Arquivos

```typescript
// Componentes React: PascalCase
MyComponent.tsx

// Pages: PascalCase + Page suffix
MyPage.tsx

// Hooks: camelCase + use prefix
useMyHook.ts

// Services: PascalCase + Service suffix
MyService.ts

// Utils: camelCase
myUtil.ts

// Types: camelCase
myTypes.ts

// Edge Functions: kebab-case
my-function/index.ts

// Migrations: timestamp_snake_case
20241201120000_add_tokens_table.sql
```

### Código

```typescript
// Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;

// Variáveis/Functions: camelCase
const userName = 'John';
function calculateTotal() {}

// Interfaces/Types: PascalCase
interface User {}
type Status = 'pending' | 'completed';

// Enum: PascalCase
enum UserRole {
  Admin = 'admin',
  User = 'user'
}

// Private functions: underscore prefix
function _internalHelper() {}

// React Components: PascalCase
function MyComponent() {}
```

---

## Padrões React

### Estrutura de Componente

```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

// 2. Types/Interfaces
interface Props {
  title: string;
  onClose: () => void;
  optional?: boolean;
}

// 3. Component
export function MyComponent({ title, onClose, optional = false }: Props) {
  // 4. Hooks (ordem: context, state, effects, custom hooks)
  const { user } = useAuth();
  const [state, setState] = useState('');

  useEffect(() => {
    // Effect logic
  }, []);

  // 5. Event handlers
  const handleClick = () => {
    // Handler logic
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Async handler logic
  };

  // 6. Helper functions
  const formatValue = (value: string) => {
    return value.toUpperCase();
  };

  // 7. Conditional rendering helpers
  if (!user) {
    return <div>Loading...</div>;
  }

  // 8. Main render
  return (
    <div className="container">
      <h1>{title}</h1>
      <button onClick={handleClick}>Click</button>
    </div>
  );
}
```

### Custom Hooks

```typescript
// hooks/useMyFeature.ts
export function useMyFeature() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getData();
      setState(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { state, loading, error, refetch: fetchData };
}
```

### Context Pattern

```typescript
// contexts/MyContext.tsx
interface MyContextType {
  value: string;
  setValue: (value: string) => void;
}

const MyContext = createContext<MyContextType | undefined>(undefined);

export function MyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');

  return (
    <MyContext.Provider value={{ value, setValue }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
}
```

---

## Padrões de Serviços

### Service Class Pattern

```typescript
// services/MyService.ts
import { supabase } from '../lib/supabase';

export class MyService {
  /**
   * Busca todos os items do usuário
   */
  static async getAll(userId: string) {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  /**
   * Cria um novo item
   */
  static async create(item: Partial<Item>) {
    const { data, error } = await supabase
      .from('items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Atualiza um item existente
   */
  static async update(id: string, updates: Partial<Item>) {
    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Deleta um item
   */
  static async delete(id: string) {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
```

---

## Padrões Edge Functions

### Estrutura Padrão

```typescript
// supabase/functions/my-function/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const { param1, param2 } = await req.json();

    // Validate inputs
    if (!param1) {
      throw new Error('param1 is required');
    }

    // Business logic
    const result = await doSomething(param1, param2);

    // Return success response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.message,
          code: 'INTERNAL_ERROR',
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### Worker Pattern

```typescript
// Worker que processa itens pendentes em loop
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(...);
    let processedCount = 0;

    while (true) {
      // Get next pending item
      const { data: item, error } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!item) break; // No more pending items

      // Mark as processing
      await supabase
        .from('items')
        .update({ status: 'processing' })
        .eq('id', item.id);

      // Process item
      try {
        await processItem(item);

        // Mark as completed
        await supabase
          .from('items')
          .update({ status: 'completed' })
          .eq('id', item.id);

        processedCount++;
      } catch (err) {
        // Handle error
        await handleError(item, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

---

## Tratamento de Erros

### Frontend

```typescript
// Padrão try-catch com toast
async function handleAction() {
  try {
    setLoading(true);
    const result = await MyService.doSomething();
    toast.success('Ação concluída com sucesso!');
    return result;
  } catch (error) {
    console.error('Error:', error);
    toast.error(error.message || 'Erro ao executar ação');
  } finally {
    setLoading(false);
  }
}

// Padrão com estado
const [error, setError] = useState<string | null>(null);

async function fetchData() {
  setError(null);
  try {
    const data = await api.getData();
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    setError(message);
  }
}
```

### Backend (Edge Functions)

```typescript
// Padrão de erro estruturado
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

function createErrorResponse(
  error: Error,
  code: string = 'INTERNAL_ERROR'
): ErrorResponse {
  return {
    success: false,
    error: {
      message: error.message,
      code,
      details: error instanceof CustomError ? error.details : undefined,
    },
  };
}

// Uso
try {
  // logic
} catch (error) {
  const response = createErrorResponse(error, 'SPECIFIC_ERROR_CODE');
  return new Response(JSON.stringify(response), {
    status: 500,
    headers: corsHeaders,
  });
}
```

---

## TypeScript

### Types vs Interfaces

```typescript
// Use interface para objetos que podem ser extendidos
interface User {
  id: string;
  name: string;
}

interface AdminUser extends User {
  role: 'admin';
}

// Use type para unions, intersections, primitives
type Status = 'pending' | 'processing' | 'completed';
type ID = string | number;
type UserWithTimestamps = User & {
  createdAt: Date;
  updatedAt: Date;
};
```

### Utility Types

```typescript
// Partial: todos os campos opcionais
type UserUpdate = Partial<User>;

// Pick: selecionar campos específicos
type UserPreview = Pick<User, 'id' | 'name'>;

// Omit: omitir campos específicos
type UserWithoutPassword = Omit<User, 'password'>;

// Required: todos os campos obrigatórios
type RequiredUser = Required<Partial<User>>;
```

### Type Guards

```typescript
// Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

// Uso
if (isUser(data)) {
  // TypeScript sabe que data é User
  console.log(data.name);
}
```

---

## Testes

### Component Tests

```typescript
// MyComponent.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls onClose when button clicked', () => {
    const handleClose = jest.fn();
    render(<MyComponent onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalled();
  });
});
```

---

## Links Relacionados

- [Visão Geral](./overview.md)
- [Guia de Contribuição](../11-contributing/CONTRIBUTING.md)
- [Frontend](../07-frontend/README.md)

---

[← Anterior: Decisões](./decisions.md) | [Ver Frontend →](../07-frontend/README.md)
