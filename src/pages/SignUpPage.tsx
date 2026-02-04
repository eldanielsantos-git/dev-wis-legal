import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader, ChevronDown, Eye, EyeOff, CheckCircle2, XCircle, Upload, User } from 'lucide-react';
import Select from 'react-select';
import { brazilianStates, type State } from '../data/brazilianLocations';
import { validatePasswordCharacters, validatePasswordStrict, sanitizePassword } from '../utils/passwordValidation';
import { translateSupabaseAuthError } from '../utils/errorTranslator';

interface SignUpPageProps {
  onNavigateToSignIn: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
}

export function SignUpPage({ onNavigateToSignIn, onNavigateToTerms, onNavigateToPrivacy }: SignUpPageProps) {
  const { signUp, signInWithGoogle, signInWithMicrosoft } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'initial' | 'type-selection' | 'details'>('initial');
  const [userType, setUserType] = useState<'PF' | 'PJ' | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phoneCountryCode: '+55', phone: '', password: '', confirmPassword: '',
    cpf: '', cnpj: '', companyName: '', oab: '', city: '', state: '', termsAccepted: false
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invite = urlParams.get('invite');
    if (invite) {
      setInviteId(invite);
    }
  }, []);

  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    maxLength: true,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    isSafe: true
  });
  const [loadingStep, setLoadingStep] = useState(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const loadingMessages = [
    'Validando informações...',
    'Criando sua conta...',
    'Configurando seu perfil...',
    'Preparando seu espaço de trabalho...',
    'Enviando email de confirmação...',
    'Finalizando cadastro...'
  ];


  const formatPhoneBrazil = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, (match, p1, p2, p3) => {
        let formatted = `(${p1})`;
        if (p2) formatted += ` ${p2}`;
        if (p3) formatted += `-${p3}`;
        return formatted;
      });
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, (match, p1, p2, p3) => {
      let formatted = `(${p1})`;
      if (p2) formatted += ` ${p2}`;
      if (p3) formatted += `-${p3}`;
      return formatted;
    });
  };

  const formatOAB = (value: string) => {
    const cleaned = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const numbers = cleaned.replace(/[A-Z]/g, '');
    const letters = cleaned.replace(/[0-9]/g, '');

    if (numbers.length <= 3) {
      return cleaned;
    }

    const formattedNumbers = numbers.replace(/(\d{1,3})(?=(\d{3})+(?!\d))/g, '$1.');
    return formattedNumbers + letters;
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return numbers.replace(/(\d{2})(\d{0,3})/, '$1.$2');
    if (numbers.length <= 8) return numbers.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
    if (numbers.length <= 12) return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) {
      return numbers;
    }
    if (numbers.length <= 6) {
      return numbers.replace(/(\d{3})(\d{0,3})/, '$1.$2');
    }
    if (numbers.length <= 9) {
      return numbers.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
    }
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  };

  const countryCodes = [
    { code: '+55', country: 'Brasil', flag: '🇧🇷', example: '(11) 98765-4321' },
    { code: '+1', country: 'EUA/Canadá', flag: '🇺🇸', example: '(555) 123-4567' },
    { code: '+44', country: 'Reino Unido', flag: '🇬🇧', example: '7911 123456' },
    { code: '+33', country: 'França', flag: '🇫🇷', example: '6 12 34 56 78' },
    { code: '+49', country: 'Alemanha', flag: '🇩🇪', example: '1512 3456789' },
    { code: '+39', country: 'Itália', flag: '🇮🇹', example: '312 345 6789' },
    { code: '+34', country: 'Espanha', flag: '🇪🇸', example: '612 34 56 78' },
    { code: '+351', country: 'Portugal', flag: '🇵🇹', example: '912 345 678' },
    { code: '+52', country: 'México', flag: '🇲🇽', example: '55 1234 5678' },
    { code: '+54', country: 'Argentina', flag: '🇦🇷', example: '11 2345-6789' },
    { code: '+56', country: 'Chile', flag: '🇨🇱', example: '9 1234 5678' },
    { code: '+57', country: 'Colômbia', flag: '🇨🇴', example: '321 1234567' },
    { code: '+51', country: 'Peru', flag: '🇵🇪', example: '987 654 321' },
    { code: '+598', country: 'Uruguai', flag: '🇺🇾', example: '94 123 456' },
    { code: '+595', country: 'Paraguai', flag: '🇵🇾', example: '981 123456' },
    { code: '+593', country: 'Equador', flag: '🇪🇨', example: '99 123 4567' },
    { code: '+591', country: 'Bolívia', flag: '🇧🇴', example: '71234567' },
    { code: '+81', country: 'Japão', flag: '🇯🇵', example: '90-1234-5678' },
    { code: '+86', country: 'China', flag: '🇨🇳', example: '138 0013 8000' },
    { code: '+91', country: 'Índia', flag: '🇮🇳', example: '98765 43210' },
    { code: '+61', country: 'Austrália', flag: '🇦🇺', example: '412 345 678' }
  ];

  const selectedCountry = countryCodes.find(c => c.code === formData.phoneCountryCode) || countryCodes[0];

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendCountdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
  }, [resendCountdown, resendDisabled]);

  const handleResendEmail = async () => {
    if (resendDisabled) return;

    const emailToUse = userEmail || formData.email;
    if (!emailToUse) {
      setError('Email não encontrado. Por favor, recarregue a página e tente novamente.');
      return;
    }

    setResendLoading(true);
    setError(null);

    try {
      const { supabase } = await import('../lib/supabase');

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, cpf, phone, phone_country_code, city, state, email_verified')
        .eq('email', emailToUse.toLowerCase())
        .maybeSingle();

      if (!profileData) {
        throw new Error('Usuário não encontrado');
      }

      if (profileData.email_verified) {
        setError(null);
        alert('Sua conta já está validada! Você pode fazer login.');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profileData.id,
          email: emailToUse,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          cpf: profileData.cpf,
          phone: profileData.phone,
          phone_country_code: profileData.phone_country_code,
          city: profileData.city,
          state: profileData.state
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao reenviar email');
      }

      setResendDisabled(true);
      setResendCountdown(60);
      setError(null);
      alert('Email de confirmação reenviado com sucesso! Verifique sua caixa de entrada.');
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar email de confirmação');
    } finally {
      setResendLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('A imagem é muito grande');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.email) {
      setError('Digite seu email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Digite um email válido');
      return;
    }

    if (!formData.termsAccepted) {
      setError('Você deve aceitar os termos de uso');
      return;
    }

    setStep('type-selection');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!userType) {
      setError('Erro: Tipo de cadastro não selecionado. Por favor, recarregue a página.');
      setLoading(false);
      return;
    }

    if (!formData.firstName.trim()) {
      setError(userType === 'PJ' ? 'Nome do responsável é obrigatório' : 'Nome é obrigatório');
      setLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError('Sobrenome é obrigatório');
      setLoading(false);
      return;
    }

    // Validação específica para PJ
    if (userType === 'PJ') {
      if (!formData.companyName.trim()) {
        setError('Nome da empresa é obrigatório');
        setLoading(false);
        return;
      }

      if (!formData.cnpj.trim()) {
        setError('CNPJ é obrigatório');
        setLoading(false);
        return;
      }

      // Validar formato do CNPJ (14 dígitos)
      const cnpjNumbers = formData.cnpj.replace(/\D/g, '');
      if (cnpjNumbers.length !== 14) {
        setError('CNPJ inválido');
        setLoading(false);
        return;
      }
    }

    if (!formData.phone.trim()) {
      setError('Telefone é obrigatório');
      setLoading(false);
      return;
    }

    if (!formData.state.trim()) {
      setError('Seccional é obrigatório');
      setLoading(false);
      return;
    }

    if (!formData.city.trim()) {
      setError('Cidade é obrigatória');
      setLoading(false);
      return;
    }

    const passwordValidation = validatePasswordStrict(formData.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message!);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }
    try {
      let avatarUrl: string | undefined = undefined;

      if (avatarFile) {
        try {
          const { supabase } = await import('../lib/supabase');
          const fileExt = avatarFile.name.split('.').pop();
          // Use temp name first, will be renamed after user creation
          const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const tempFilePath = `${tempFileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(tempFilePath, avatarFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('avatars')
              .getPublicUrl(tempFilePath);
            avatarUrl = publicUrl;
          }
        } catch (uploadErr) {
        }
      }

      await signUp(formData.email, formData.password, {
        type: userType!,
        first_name: formData.firstName,
        last_name: formData.lastName,
        company_name: userType === 'PJ' ? formData.companyName : undefined,
        phone: formData.phone,
        phone_country_code: formData.phoneCountryCode,
        cpf: userType === 'PF' && formData.cpf ? formData.cpf.replace(/\D/g, '') : undefined,
        cnpj: userType === 'PJ' ? formData.cnpj.replace(/\D/g, '') : undefined,
        oab: formData.oab || undefined,
        city: formData.city,
        state: formData.state,
        avatar_url: avatarUrl
      });

      if (inviteId) {
        try {
          const { supabase } = await import('../lib/supabase');
          const { error: updateError } = await supabase
            .from('invite_friend')
            .update({ status: 'accepted' })
            .eq('id', inviteId);
        } catch (inviteErr) {
        }
      }

      setUserEmail(formData.email);
      setSuccess(true);
      setResendDisabled(true);
      setResendCountdown(60);
    } catch (err: any) {
      setError(translateSupabaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (success && !showSuccessMessage) {
      const interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev >= loadingMessages.length - 1) {
            clearInterval(interval);
            setTimeout(() => setShowSuccessMessage(true), 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 1700);

      return () => clearInterval(interval);
    }
  }, [success, showSuccessMessage]);

  if (success) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-md w-full text-center px-2 sm:px-0">
            {!showSuccessMessage ? (
              <>
                <Loader className="w-12 h-12 md:w-16 md:h-16 animate-spin mx-auto mb-4 md:mb-6 text-wis-dark" />
                <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4">
                  Criando sua conta
                </h1>
                <div className="mb-6">
                  {loadingMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-center gap-2 py-2 transition-all duration-500 ${
                        index === loadingStep
                          ? 'opacity-100 text-wis-dark font-semibold'
                          : index < loadingStep
                          ? 'opacity-50 text-green-600'
                          : 'opacity-30 text-gray-400'
                      }`}
                    >
                      {index < loadingStep && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {index === loadingStep && (
                        <Loader className="w-4 h-4 animate-spin text-wis-dark" />
                      )}
                      <span className="text-sm">{message}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 text-green-600" />
                <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-3 md:mb-4">Conta criada!</h1>
                <div className="mb-4 md:mb-6 text-center">
                  <p className="text-gray-900 text-sm font-semibold mb-2">Acesse a caixa de entrada de seu email informado no cadastro para fazer a verificação de sua conta.</p>
                  <p className="text-gray-500 text-sm">Se não localizar, verifique a caixa de spam ou lixo eletrônico.</p>
                </div>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <div className="space-y-3">
                  <button onClick={onNavigateToSignIn} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base">Ir para Login</button>
                  <button
                    onClick={handleResendEmail}
                    disabled={resendDisabled || resendLoading}
                    className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {resendLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        Reenviando...
                      </>
                    ) : resendDisabled ? (
                      `Reenviar email (${resendCountdown}s)`
                    ) : (
                      'Reenviar email de confirmação'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'initial') {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-sm w-full px-2 sm:px-0">
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-2 text-center">Criar Conta</h1>
            <p className="text-gray-600 mb-4 md:mb-8 text-center">Comece sua jornada conosco</p>
            {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <form onSubmit={handleInitialSubmit} className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="terms"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                  className="mr-2 w-4 h-4 border border-gray-300 rounded bg-white checked:bg-white checked:border-gray-900 focus:ring-0 focus:ring-offset-0 appearance-none cursor-pointer relative checked:after:content-['✓'] checked:after:absolute checked:after:text-gray-900 checked:after:text-xs checked:after:left-1/2 checked:after:top-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 flex-shrink-0"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  Aceito os{' '}
                  <a
                    href="http://wislegal.io/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-wis-dark hover:underline font-medium"
                  >
                    termos de uso
                  </a>
                  {' '}e a{' '}
                  <a
                    href="http://wislegal.io/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-wis-dark hover:underline font-medium"
                  >
                    política de privacidade
                  </a>
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm md:text-base"
              >
                Criar Conta
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setGoogleLoading(true);
                  setError(null);
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    setError(translateSupabaseAuthError(err));
                    setGoogleLoading(false);
                  }
                }}
                disabled={googleLoading || microsoftLoading}
                className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base"
              >
                {googleLoading ? (
                  <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Conectando...</>
                ) : (
                  <><svg className="w-4 md:w-5 h-4 md:h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continuar com Google</>
                )}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMicrosoftLoading(true);
                  setError(null);
                  try {
                    await signInWithMicrosoft();
                  } catch (err: any) {
                    setError(translateSupabaseAuthError(err));
                    setMicrosoftLoading(false);
                  }
                }}
                disabled={googleLoading || microsoftLoading}
                className="w-full bg-white text-gray-700 py-2.5 md:py-3 px-4 rounded-lg border-2 border-gray-300 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm md:text-base"
              >
                {microsoftLoading ? (
                  <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Conectando...</>
                ) : (
                  <>
                    <svg className="w-4 md:w-5 h-4 md:h-5 mr-2" viewBox="0 0 21 21">
                      <path fill="#f25022" d="M0 0h10v10H0z"/>
                      <path fill="#00a4ef" d="M11 0h10v10H11z"/>
                      <path fill="#7fba00" d="M0 11h10v10H0z"/>
                      <path fill="#ffb900" d="M11 11h10v10H11z"/>
                    </svg>
                    Continuar com Microsoft
                  </>
                )}
              </button>
              <p className="text-center text-sm text-gray-600">
                Já tem uma conta?{' '}
                <button type="button" onClick={onNavigateToSignIn} className="text-wis-dark hover:underline font-medium">Faça login</button>
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Tela de seleção de tipo de cadastro (PF ou PJ)
  if (step === 'type-selection') {
    return (
      <div className="min-h-screen flex flex-col md:flex-row font-body">
        <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
          <div className="text-center">
            <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
            <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
          </div>
        </div>
        <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
          <div className="max-w-sm w-full px-2 sm:px-0">
            <button
              type="button"
              onClick={() => setStep('initial')}
              className="mb-4 text-gray-600 hover:text-gray-900 flex items-center text-sm"
            >
              ← Voltar
            </button>
            <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-4 md:mb-8 text-center">
              Qual o tipo de cadastro que deseja fazer?
            </h1>
            {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setUserType('PF');
                  setStep('details');
                }}
                className="w-full bg-black text-white py-4 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-base"
              >
                Pessoa Física
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserType('PJ');
                  setStep('details');
                }}
                className="w-full bg-black text-white py-4 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-base"
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-body">
      <div className="w-full md:w-1/2 bg-wis-dark flex items-center justify-center p-6 md:p-12">
        <div className="text-center">
          <img src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg" alt="Wis Legal" className="h-12 md:h-16 mx-auto mb-4 md:mb-6" />
          <p className="text-white text-lg md:text-xl font-title">Plataforma para análise de processos</p>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-6 md:p-12 rounded-3xl md:rounded-none">
        <div className="max-w-sm w-full px-2 sm:px-0">
          <button
            type="button"
            onClick={() => setStep('type-selection')}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center text-sm"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl md:text-3xl font-title font-bold text-gray-900 mb-4 md:mb-8 text-center">
            {userType === 'PF' ? 'Cadastro Pessoal' : 'Cadastro Corporativo'}
          </h1>
          {error && <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
            <div className="flex flex-col items-center">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {userType === 'PF' ? 'Foto de perfil' : 'Logo da empresa'} <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <div className="relative inline-block">
                <div
                  onClick={handleAvatarClick}
                  className="w-20 h-20 rounded-full overflow-hidden border border-gray-300 cursor-pointer hover:border-gray-400 transition-colors bg-gray-100 flex items-center justify-center group"
                >
                  {avatarPreview ? (
                    <>
                      <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </>
                  ) : (
                    <User className="w-9 h-9 text-gray-400 stroke-[1.5]" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center border border-gray-300 shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-gray-500 stroke-[1.5]" />
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{userType === 'PJ' ? 'Nome do responsável' : 'Nome'}</label><input type="text" required value={formData.firstName} onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
                setFormData({ ...formData, firstName: value });
              }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Sobrenome</label><input type="text" required value={formData.lastName} onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
                setFormData({ ...formData, lastName: value });
              }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600" /></div>
            </div>
            {userType === 'PJ' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '');
                    setFormData({ ...formData, companyName: value });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={formData.phoneCountryCode}
                    onChange={(e) => setFormData({ ...formData, phoneCountryCode: e.target.value })}
                    className="appearance-none w-32 px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-white cursor-pointer text-gray-600"
                  >
                    {countryCodes.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    const formatted = formData.phoneCountryCode === '+55'
                      ? formatPhoneBrazil(e.target.value)
                      : e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, phone: formatted });
                  }}
                  placeholder={selectedCountry.example}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
              </div>
            </div>
            {userType === 'PF' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => {
                    const formatted = formatCPF(e.target.value);
                    setFormData({ ...formData, cpf: formatted });
                  }}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  required
                  value={formData.cnpj}
                  onChange={(e) => {
                    const formatted = formatCNPJ(e.target.value);
                    setFormData({ ...formData, cnpj: formatted });
                  }}
                  placeholder="09.031.011/0001-23"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {userType === 'PJ' ? 'OAB do responsável' : 'OAB'} <span className="text-gray-400 text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.oab}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
                  setFormData({ ...formData, oab: value });
                }}
                placeholder="Digite o número da OAB"
                maxLength={20}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seccional</label>
              <Select
                value={selectedState}
                onChange={(option) => {
                  setSelectedState(option);
                  setFormData({ ...formData, state: option?.label || '' });
                }}
                options={brazilianStates}
                placeholder="Selecione um estado"
                isClearable={false}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: '#d1d5db',
                    borderRadius: '0.5rem',
                    padding: '0.125rem 0.5rem',
                    minHeight: '42px',
                    '&:hover': { borderColor: '#d1d5db' },
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: '#9ca3af',
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: '#6b7280',
                  }),
                  option: (base, state) => ({
                    ...base,
                    color: '#6b7280',
                    backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
                    '&:hover': {
                      backgroundColor: '#f3f4f6',
                    },
                  }),
                  menu: (base) => ({
                    ...base,
                    borderRadius: '0.5rem',
                    marginTop: '0.25rem',
                  }),
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => {
                  const value = e.target.value.replace(/[0-9]/g, '');
                  setFormData({ ...formData, city: value });
                }}
                placeholder="Digite sua cidade"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => {
                    const sanitized = sanitizePassword(e.target.value);
                    setFormData({ ...formData, password: sanitized });
                    setPasswordValidation(validatePasswordCharacters(sanitized));
                    if (formData.confirmPassword && sanitized !== formData.confirmPassword) {
                      setError('As senhas não coincidem');
                    } else if (sanitized === formData.confirmPassword) {
                      setError(null);
                    }
                  }}
                  minLength={6}
                  maxLength={24}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.minLength ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}>
                    Mínimo de 6 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.maxLength ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={passwordValidation.maxLength ? 'text-green-600' : 'text-red-600'}>
                    Máximo de 24 caracteres
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasUppercase ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                    Letra maiúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasLowercase ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                    Letra minúscula
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasNumber ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                    Número
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {passwordValidation.hasSpecialChar ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}>
                    Caractere especial (!@$%...)
                  </span>
                </div>
                {!passwordValidation.isSafe && (
                  <div className="flex items-center gap-2 text-xs mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-red-600">
                      Senha contém padrões não permitidos. Use apenas letras, números e caracteres especiais comuns.
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => {
                    const sanitized = sanitizePassword(e.target.value);
                    setFormData({ ...formData, confirmPassword: sanitized });
                    if (sanitized && formData.password !== sanitized) {
                      setError('As senhas não coincidem');
                    } else if (formData.password === sanitized) {
                      setError(null);
                    }
                  }}
                  minLength={6}
                  maxLength={24}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-300 bg-transparent text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {formData.confirmPassword && (
                <div className="flex items-center gap-2 mt-1">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <p className="text-xs text-green-500">As senhas coincidem</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <p className="text-xs text-red-500">As senhas não coincidem</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <button type="submit" disabled={loading} className="w-full bg-wis-dark text-white py-2.5 md:py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 flex items-center justify-center text-sm md:text-base">
              {loading ? <><Loader className="w-4 md:w-5 h-4 md:h-5 animate-spin mr-2" />Criando...</> : 'Concluir Cadastro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
