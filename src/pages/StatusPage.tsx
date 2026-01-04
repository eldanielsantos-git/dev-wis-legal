import React, { useEffect, useState } from 'react';
import { Activity, Database, Shield, HardDrive, Radio, Cloud, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('StatusPage error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0F0E0D] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#1a1918] border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Erro ao carregar página</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Ocorreu um erro ao carregar a página de status.
            </p>
            {this.state.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
                <p className="text-red-800 dark:text-red-300 text-sm font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ServiceStatus {
  database: 'healthy' | 'unhealthy' | 'checking';
  auth: 'healthy' | 'unhealthy' | 'checking';
  storage: 'healthy' | 'unhealthy' | 'checking';
  realtime: 'healthy' | 'unhealthy' | 'checking';
  edgeFunctions: 'healthy' | 'unhealthy' | 'checking';
  checkedAt: string;
}

interface ServiceConfig {
  key: keyof Omit<ServiceStatus, 'checkedAt'>;
  name: string;
  icon: React.ElementType;
  description: string;
}

const services: ServiceConfig[] = [
  {
    key: 'database',
    name: 'Database (Postgres)',
    icon: Database,
    description: 'Conexão e consultas ao banco de dados'
  },
  {
    key: 'auth',
    name: 'Authentication',
    icon: Shield,
    description: 'Sistema de autenticação de usuários'
  },
  {
    key: 'storage',
    name: 'Storage',
    icon: HardDrive,
    description: 'Armazenamento de arquivos'
  },
  {
    key: 'realtime',
    name: 'Realtime',
    icon: Radio,
    description: 'Atualizações em tempo real'
  },
  {
    key: 'edgeFunctions',
    name: 'Edge Functions',
    icon: Cloud,
    description: 'Funções serverless'
  }
];

function StatusPageContent() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setCheckingAdmin(false);
        setIsAdmin(false);
        window.location.href = '/signin';
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao verificar permissões:', error);
          setIsAdmin(false);
          setCheckingAdmin(false);
          return;
        }

        if (!profile?.is_admin) {
          window.location.href = '/app';
          return;
        }

        setIsAdmin(true);
        setCheckingAdmin(false);
      } catch (err) {
        console.error('Erro ao verificar admin:', err);
        setIsAdmin(false);
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  const fetchStatus = async () => {
    try {
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        throw new Error('Variáveis de ambiente não configuradas');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/system-health-check`,
        {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao buscar status (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchStatus();
    }
  }, [isAdmin, checkingAdmin]);

  useEffect(() => {
    if (!autoRefresh || !isAdmin || checkingAdmin) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, isAdmin, checkingAdmin]);

  const handleRefresh = () => {
    setLoading(true);
    fetchStatus();
  };

  const getStatusIcon = (serviceStatus: 'healthy' | 'unhealthy' | 'checking') => {
    if (serviceStatus === 'healthy') {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (serviceStatus === 'unhealthy') {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  const getStatusColor = (serviceStatus: 'healthy' | 'unhealthy' | 'checking') => {
    if (serviceStatus === 'healthy') return 'bg-green-500';
    if (serviceStatus === 'unhealthy') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = (serviceStatus: 'healthy' | 'unhealthy' | 'checking') => {
    if (serviceStatus === 'healthy') return 'Operacional';
    if (serviceStatus === 'unhealthy') return 'Indisponível';
    return 'Verificando...';
  };

  const allHealthy = status && Object.entries(status)
    .filter(([key]) => key !== 'checkedAt')
    .every(([, value]) => value === 'healthy');

  const bgColor = theme === 'dark' ? 'bg-[#0F0E0D]' : 'bg-gray-50';
  const cardBg = theme === 'dark' ? 'bg-[#1a1918]' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-gray-800' : 'border-gray-200';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

  if (checkingAdmin) {
    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center`}>
        <div className="text-center">
          <RefreshCw className={`w-12 h-12 ${textPrimary} animate-spin mx-auto mb-4`} />
          <p className={textSecondary}>Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className={`min-h-screen ${bgColor} ${textPrimary}`}>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Status do Sistema</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${cardBg} border ${borderColor} hover:bg-opacity-80 transition-colors disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
          <p className={textSecondary}>
            Monitoramento em tempo real dos serviços do Supabase
          </p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-lg border border-red-500 bg-red-500 bg-opacity-10`}>
            <div className="flex flex-col gap-2">
              <p className="text-red-500 font-semibold">Erro ao carregar status:</p>
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <div className={`mb-8 p-6 rounded-lg ${cardBg} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1">Status Geral</h2>
              <p className={textSecondary}>
                {loading ? 'Verificando serviços...' :
                 allHealthy ? 'Todos os serviços operacionais' :
                 'Alguns serviços apresentam problemas'}
              </p>
            </div>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              loading ? 'bg-yellow-500' :
              allHealthy ? 'bg-green-500' :
              'bg-red-500'
            } bg-opacity-20`}>
              {loading ? (
                <RefreshCw className={`w-8 h-8 animate-spin ${
                  loading ? 'text-yellow-500' :
                  allHealthy ? 'text-green-500' :
                  'text-red-500'
                }`} />
              ) : allHealthy ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
          </div>
          {status?.checkedAt && (
            <div className={`mt-4 flex items-center gap-2 ${textSecondary} text-sm`}>
              <Clock className="w-4 h-4" />
              <span>Última verificação: {new Date(status.checkedAt).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const serviceStatus = status?.[service.key] ?? 'checking';
            const Icon = service.icon;

            return (
              <div
                key={service.key}
                className={`p-6 rounded-lg ${cardBg} border ${borderColor} transition-all hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      serviceStatus === 'healthy' ? 'bg-green-500' :
                      serviceStatus === 'unhealthy' ? 'bg-red-500' :
                      'bg-yellow-500'
                    } bg-opacity-20`}>
                      <Icon className={`w-6 h-6 ${
                        serviceStatus === 'healthy' ? 'text-green-500' :
                        serviceStatus === 'unhealthy' ? 'text-red-500' :
                        'text-yellow-500'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                    </div>
                  </div>
                  {getStatusIcon(serviceStatus)}
                </div>

                <p className={`${textSecondary} text-sm mb-4`}>
                  {service.description}
                </p>

                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(serviceStatus)}`} />
                  <span className="text-sm font-medium">
                    {getStatusText(serviceStatus)}
                  </span>
                </div>

                <div className="mt-4 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(serviceStatus)} transition-all duration-500`}
                    style={{
                      width: serviceStatus === 'healthy' ? '100%' :
                             serviceStatus === 'unhealthy' ? '0%' :
                             '50%'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StatusPage() {
  return (
    <ErrorBoundary>
      <StatusPageContent />
    </ErrorBoundary>
  );
}
