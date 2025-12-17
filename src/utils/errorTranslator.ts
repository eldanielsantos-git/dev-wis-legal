const errorMappings: Record<string, string> = {
  // Auth errors
  'Invalid login credentials': 'Credenciais de login inválidas',
  'Email not confirmed': 'Email não confirmado',
  'User already registered': 'Usuário já cadastrado',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  'Unable to validate email address: invalid format': 'Formato de email inválido',
  'Invalid email': 'Email inválido',
  'Email address is invalid': 'Endereço de email inválido',
  'Please check your credentials': 'Por favor, verifique suas credenciais',
  'User not found': 'Usuário não encontrado',
  'Invalid refresh token': 'Token de atualização inválido',
  'Token has expired or is invalid': 'Token expirado ou inválido',
  'Email rate limit exceeded': 'Limite de envio de emails excedido',
  'Signups not allowed for this instance': 'Cadastros não permitidos nesta instância',
  'Password is too weak': 'Senha muito fraca',
  'New password should be different from the old password': 'A nova senha deve ser diferente da senha anterior',

  // Database errors
  'duplicate key value violates unique constraint': 'Valor duplicado - registro já existe',
  'violates foreign key constraint': 'Erro de referência - registro relacionado não existe',
  'violates not-null constraint': 'Campo obrigatório não preenchido',
  'permission denied': 'Permissão negada',
  'row-level security policy': 'Você não tem permissão para acessar este recurso',

  // Network/Connection errors
  'Failed to fetch': 'Falha na conexão com o servidor',
  'Network request failed': 'Falha na requisição de rede',
  'timeout': 'Tempo limite excedido',
  'NetworkError': 'Erro de conexão',

  // General errors
  'Something went wrong': 'Algo deu errado',
  'Internal server error': 'Erro interno do servidor',
  'Service temporarily unavailable': 'Serviço temporariamente indisponível',
  'Too many requests': 'Muitas requisições - tente novamente em alguns instantes',
  'Bad request': 'Requisição inválida',
  'Unauthorized': 'Não autorizado',
  'Forbidden': 'Acesso negado',
  'Not found': 'Não encontrado',

  // Token/Subscription errors
  'Insufficient tokens': 'Tokens insuficientes',
  'No active subscription': 'Nenhuma assinatura ativa',
  'Subscription expired': 'Assinatura expirada',
  'Payment required': 'Pagamento necessário',
};

const partialErrorMappings: Array<{ pattern: RegExp; translation: string }> = [
  { pattern: /email.*invalid/i, translation: 'Email inválido' },
  { pattern: /email.*not.*confirmed/i, translation: 'Email não confirmado' },
  { pattern: /password.*weak/i, translation: 'Senha muito fraca' },
  { pattern: /password.*least.*\d+.*characters/i, translation: 'A senha deve ter pelo menos 6 caracteres' },
  { pattern: /invalid.*credentials/i, translation: 'Credenciais inválidas' },
  { pattern: /user.*already.*exists/i, translation: 'Usuário já existe' },
  { pattern: /rate.*limit.*exceeded/i, translation: 'Limite de requisições excedido' },
  { pattern: /token.*expired/i, translation: 'Token expirado' },
  { pattern: /token.*invalid/i, translation: 'Token inválido' },
  { pattern: /permission.*denied/i, translation: 'Permissão negada' },
  { pattern: /not.*authorized/i, translation: 'Não autorizado' },
  { pattern: /insufficient.*tokens/i, translation: 'Tokens insuficientes' },
  { pattern: /failed.*to.*fetch/i, translation: 'Falha na conexão' },
  { pattern: /network.*error/i, translation: 'Erro de conexão' },
  { pattern: /timeout/i, translation: 'Tempo limite excedido' },
];

export function translateError(error: unknown): string {
  if (!error) {
    return 'Erro desconhecido';
  }

  let errorMessage = '';

  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    } else if ('error' in error && typeof error.error === 'string') {
      errorMessage = error.error;
    } else if ('msg' in error && typeof error.msg === 'string') {
      errorMessage = error.msg;
    } else {
      errorMessage = JSON.stringify(error);
    }
  }

  if (!errorMessage) {
    return 'Erro desconhecido';
  }

  const exactMatch = errorMappings[errorMessage];
  if (exactMatch) {
    return exactMatch;
  }

  for (const { pattern, translation } of partialErrorMappings) {
    if (pattern.test(errorMessage)) {
      return translation;
    }
  }

  if (errorMessage.length > 100) {
    return 'Ocorreu um erro. Tente novamente.';
  }

  return errorMessage;
}

export function translateSupabaseAuthError(error: unknown): string {
  if (!error) {
    return 'Erro de autenticação desconhecido';
  }

  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof error.code === 'string') {
      const codeTranslations: Record<string, string> = {
        'invalid_credentials': 'Credenciais inválidas',
        'email_not_confirmed': 'Email não confirmado',
        'user_already_exists': 'Usuário já existe',
        'weak_password': 'Senha muito fraca',
        'invalid_email': 'Email inválido',
        'email_exists': 'Este email já está cadastrado',
        'over_email_send_rate_limit': 'Limite de envio de emails excedido. Tente novamente em alguns minutos.',
        'over_request_rate_limit': 'Muitas tentativas. Aguarde alguns instantes.',
        'user_not_found': 'Usuário não encontrado',
        'invalid_refresh_token': 'Sessão expirada. Faça login novamente.',
        'token_expired': 'Sessão expirada. Faça login novamente.',
        'validation_failed': 'Dados inválidos',
        'signup_disabled': 'Cadastros temporariamente desabilitados',
      };

      if (codeTranslations[error.code]) {
        return codeTranslations[error.code];
      }
    }
  }

  return translateError(error);
}

export function translateDatabaseError(error: unknown): string {
  if (!error) {
    return 'Erro de banco de dados desconhecido';
  }

  if (typeof error === 'object' && error !== null) {
    if ('code' in error && typeof error.code === 'string') {
      const dbErrorCodes: Record<string, string> = {
        '23505': 'Este registro já existe',
        '23503': 'Não é possível excluir - existem registros relacionados',
        '23502': 'Campos obrigatórios não preenchidos',
        '42501': 'Você não tem permissão para realizar esta ação',
        'PGRST301': 'Você não tem permissão para acessar este recurso',
        '42P01': 'Recurso não encontrado',
        '42703': 'Campo inválido',
        '22P02': 'Formato de dados inválido',
      };

      if (dbErrorCodes[error.code]) {
        return dbErrorCodes[error.code];
      }
    }

    if ('details' in error && typeof error.details === 'string') {
      return translateError(error.details);
    }

    if ('hint' in error && typeof error.hint === 'string') {
      return translateError(error.hint);
    }
  }

  return translateError(error);
}

export function getErrorMessage(error: unknown, defaultMessage = 'Ocorreu um erro inesperado'): string {
  const translated = translateError(error);

  if (translated === 'Erro desconhecido') {
    return defaultMessage;
  }

  return translated;
}
