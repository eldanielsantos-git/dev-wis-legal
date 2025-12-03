export interface PasswordValidation {
  minLength: boolean;
  maxLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isSafe: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
  validation?: PasswordValidation;
}

const MALICIOUS_PATTERNS = [
  /(<script[\s\S]*?>[\s\S]*?<\/script>)/gi,
  /(javascript:)/gi,
  /(on\w+\s*=)/gi,
  /(<iframe[\s\S]*?>)/gi,
  /(<object[\s\S]*?>)/gi,
  /(<embed[\s\S]*?>)/gi,
  /(data:text\/html)/gi,
  /(eval\()/gi,
  /(expression\()/gi,
  /(vbscript:)/gi,
  /(\bselect\b.*\bfrom\b)/gi,
  /(\bunion\b.*\bselect\b)/gi,
  /(\binsert\b.*\binto\b)/gi,
  /(\bupdate\b.*\bset\b)/gi,
  /(\bdelete\b.*\bfrom\b)/gi,
  /(\bdrop\b.*\btable\b)/gi,
  /(--|\#|\/\*|\*\/)/g,
  /(\bor\b\s*\d+\s*=\s*\d+)/gi,
  /(\band\b\s*\d+\s*=\s*\d+)/gi,
  /(1=1|1'='1)/gi,
  /(exec\()/gi,
  /(execute\()/gi,
  /(<\?php)/gi,
  /(\$_GET|\$_POST|\$_REQUEST|\$_SERVER)/gi,
  /(base64_decode)/gi,
  /(shell_exec)/gi,
  /(system\()/gi,
  /(passthru\()/gi,
  /(proc_open)/gi,
  /(popen\()/gi,
];

const ALLOWED_SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function detectMaliciousInput(input: string): boolean {
  if (!input) return false;

  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }

  const consecutiveSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{4,}/;
  if (consecutiveSpecialChars.test(input)) {
    return true;
  }

  const multipleAngleBrackets = /<{2,}|>{2,}/;
  if (multipleAngleBrackets.test(input)) {
    return true;
  }

  return false;
}

export function validatePasswordCharacters(password: string): PasswordValidation {
  return {
    minLength: password.length >= 6,
    maxLength: password.length <= 24,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: ALLOWED_SPECIAL_CHARS.test(password),
    isSafe: !detectMaliciousInput(password)
  };
}

export function validatePasswordStrict(password: string): PasswordValidationResult {
  if (!password) {
    return { valid: false, message: 'A senha é obrigatória' };
  }

  if (detectMaliciousInput(password)) {
    return {
      valid: false,
      message: 'Senha contém caracteres ou padrões não permitidos. Use apenas letras, números e caracteres especiais comuns.'
    };
  }

  if (password.length < 6) {
    return { valid: false, message: 'A senha deve ter no mínimo 6 caracteres' };
  }

  if (password.length > 24) {
    return { valid: false, message: 'A senha deve ter no máximo 24 caracteres' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra minúscula' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos uma letra maiúscula' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um número' };
  }

  if (!ALLOWED_SPECIAL_CHARS.test(password)) {
    return { valid: false, message: 'A senha deve conter pelo menos um caractere especial (!@#$%...)' };
  }

  const validation = validatePasswordCharacters(password);
  return { valid: true, validation };
}

export function sanitizePassword(password: string): string {
  return password.slice(0, 24);
}
