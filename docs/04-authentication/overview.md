# Autenticação - Overview

Sistema de autenticação baseado em Supabase Auth.

## Visão Geral

O sistema usa **Supabase Authentication** com email/password como método principal.

### Features

- Email/Password authentication
- Email verification
- Password reset
- JWT tokens
- Refresh tokens automáticos
- Session management

## Fluxo de Autenticação

### Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
});
```

**Processo:**
1. User preenche formulário
2. Frontend valida (senha forte, email válido)
3. Supabase cria usuário em `auth.users`
4. Trigger cria `token_balance` e `user_preferences`
5. Email de verificação enviado
6. Usuário logado automaticamente

### Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securePassword123'
});
```

### Password Reset

```typescript
// Request reset
await supabase.auth.resetPasswordForEmail('user@example.com', {
  redirectTo: 'https://app.com/reset-password'
});

// Update password
await supabase.auth.updateUser({
  password: 'newPassword123'
});
```

## Gestão de Sessões

### Token Storage

```typescript
// Tokens armazenados em localStorage
// - access_token (1h expiry)
// - refresh_token (long-lived)
```

### Auto Refresh

Supabase automaticamente renova tokens expirados usando refresh token.

## AuthContext

```typescript
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Proteção de Rotas

```typescript
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/signin" />;
  }

  return <>{children}</>;
}
```

## RLS Policies

Todas as queries ao banco usam `auth.uid()` para filtrar por usuário.

```sql
CREATE POLICY "Users can view own processos"
  ON processos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

---

[← Voltar ao Authentication](./README.md)
