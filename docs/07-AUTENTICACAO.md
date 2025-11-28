# 07 - Sistema de Autenticação e Autorização

## 📋 Visão Geral

O WisLegal utiliza **Supabase Auth** para gerenciamento completo de autenticação e autorização. O sistema suporta múltiplos providers e implementa segurança em várias camadas.

## 🔐 Métodos de Autenticação

### 1. Email e Senha

**Fluxo de Cadastro:**
```typescript
const { error } = await supabase.auth.signUp({
  email: 'usuario@example.com',
  password: 'senha-segura-123',
  options: {
    data: {
      first_name: 'João',
      last_name: 'Silva',
      phone: '11987654321',
      oab: 'OAB/SP 123456'
    }
  }
});
```

**Fluxo de Login:**
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email: 'usuario@example.com',
  password: 'senha-segura-123'
});
```

### 2. OAuth com Google

```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/app`
  }
});
```

**Extração de Dados do Google:**
- Nome completo (dividido em first_name e last_name)
- Email
- Foto de perfil (avatar_url)

## 👤 Perfis de Usuário

### Tabela: user_profiles

Criada automaticamente via trigger após signup:

```sql
CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();
```

**Function: create_user_profile()**
```sql
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Extrair nome do metadata
  v_first_name := COALESCE(
    NEW.raw_user_meta_data->>'first_name',
    split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1),
    'Usuário'
  );

  v_last_name := COALESCE(
    NEW.raw_user_meta_data->>'last_name',
    substr(NEW.raw_user_meta_data->>'full_name',
           length(split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1)) + 2
    ),
    ''
  );

  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    phone,
    oab,
    avatar_url,
    terms_accepted_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'oab',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## 🔄 AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

### Estado Global

```typescript
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email, password, profileData) => Promise<void>;
  signIn: (email, password) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email) => Promise<void>;
  updatePassword: (newPassword) => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
}
```

### Inicialização

```typescript
useEffect(() => {
  // Obter sessão atual
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      loadProfile(session.user.id);
    } else {
      setLoading(false);
    }
  });

  // Listener de mudanças
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### Carregar Perfil

```typescript
const loadProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    setProfile(null);
  } else {
    setProfile(data);
  }

  setLoading(false);
};
```

## 🚪 Fluxo de Login Completo

```
┌──────────────────┐
│  1. User Input   │
│  - Email         │
│  - Password      │
└────────┬─────────┘
         │
         ↓
┌──────────────────────────────┐
│  2. Frontend Validation      │
│  - Email format              │
│  - Password strength         │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  3. Supabase Auth            │
│  - signInWithPassword()      │
└────────┬─────────────────────┘
         │
         ├─── Sucesso ──────┐
         │                  │
         ↓                  ↓
┌────────────────┐   ┌──────────────┐
│  4. Get Session│   │  Error       │
│  - access_token│   │  - Invalid   │
│  - refresh_tok │   │  credentials │
└────────┬───────┘   └──────────────┘
         │
         ↓
┌──────────────────────────────┐
│  5. Load Profile             │
│  - Query user_profiles       │
│  - Apply RLS                 │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  6. Update Context           │
│  - setUser()                 │
│  - setProfile()              │
│  - setSession()              │
└────────┬─────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│  7. Redirect                 │
│  - Navigate to /app          │
└──────────────────────────────┘
```

## 🚫 Fluxo de Logout

```typescript
const signOut = async () => {
  // 1. Chamar Supabase signOut
  const { error } = await supabase.auth.signOut({ scope: 'global' });

  if (error) throw error;

  // 2. Limpar estado
  setUser(null);
  setSession(null);
  setProfile(null);

  // 3. Limpar storage
  localStorage.clear();
  sessionStorage.clear();

  // 4. Limpar cookies
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
    document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
  }

  // 5. Redirect
  window.location.href = '/sign-in';
};
```

## 🔑 Recuperação de Senha

### Solicitar Reset

```typescript
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) throw error;

  // Email enviado com link mágico
};
```

### Atualizar Senha

```typescript
const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
};
```

**Fluxo:**
1. Usuário clica "Esqueci minha senha"
2. Insere email
3. Supabase envia email com link
4. Link redireciona para /reset-password com token
5. Usuário insere nova senha
6. updatePassword() atualiza

## 🛡️ Proteção de Rotas

### Protected Route Pattern

```typescript
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    // Redireciona para login
    return <SignInPage />;
  }

  // Usuário autenticado
  return <AppHomePage />;
}
```

### Admin-Only Routes

```typescript
function AdminPage() {
  const { profile, isAdmin } = useAuth();

  if (!isAdmin) {
    return <div>Acesso negado</div>;
  }

  return <AdminDashboard />;
}
```

## 👮 Sistema de Permissões

### Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| **user** | Usuário padrão | - Ver próprios processos<br>- Criar processos<br>- Chat<br>- Ver próprio perfil |
| **admin** | Administrador | - Tudo de user<br>- Ver todos os usuários<br>- Gestão de prompts<br>- Gestão de modelos<br>- Analytics<br>- Gestão de quotas |

### Verificação de Admin

**No Frontend:**
```typescript
const { isAdmin } = useAuth();

{isAdmin && (
  <Link to="/admin-settings">Admin Panel</Link>
)}
```

**No Backend (RLS):**
```sql
-- Admins veem todos os processos
CREATE POLICY "Admins can view all processos"
  ON processos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );
```

## 🔒 Segurança Adicional

### Password Requirements

```typescript
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Senha deve ter no mínimo 8 caracteres';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter letra maiúscula';
  }

  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter letra minúscula';
  }

  if (!/[0-9]/.test(password)) {
    return 'Senha deve conter número';
  }

  return null; // Válida
}
```

### Rate Limiting

Supabase Auth possui rate limiting built-in:
- **Login**: 5 tentativas / 5 minutos
- **Signup**: 10 tentativas / hora
- **Password Reset**: 5 tentativas / hora

### Session Management

- **Access Token**: Válido por 1 hora
- **Refresh Token**: Válido por 30 dias
- **Auto-refresh**: Automático antes de expirar

```typescript
// Supabase gerencia automaticamente
// Refresh acontece transparentemente
```

## 🔄 Persistência de Sessão

### Storage

Supabase Auth usa `localStorage` por padrão:

```javascript
// Chave: supabase.auth.token
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_at": 1234567890
}
```

### Restauração Automática

```typescript
// Ao carregar a página
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      // Sessão restaurada
      setUser(session.user);
    }
  });
}, []);
```

## 📊 Auditoria de Acesso

### Logs de Auth

Supabase Dashboard → Authentication → Logs

Mostra:
- Logins bem-sucedidos
- Logins falhados
- Signups
- Password resets
- OAuth attempts

### Custom Logging

```typescript
// Após login bem-sucedido
await supabase
  .from('auth_logs')
  .insert({
    user_id: user.id,
    action: 'login',
    ip_address: request.ip,
    user_agent: request.headers['user-agent']
  });
```

## 🔗 Próximos Documentos

- **[08-SEGURANCA-RLS.md](./08-SEGURANCA-RLS.md)** - Row Level Security
- **[15-SISTEMA-TOKENS.md](./15-SISTEMA-TOKENS.md)** - Sistema de tokens

---

**Autenticação robusta e segura**
