import React, { useEffect, useState } from 'react';
import { Activity, Database, Shield, HardDrive, Radio, Cloud, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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

export function StatusPage() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/system-health-check`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao buscar status');
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

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
            <p className="text-red-500">Erro ao carregar status: {error}</p>
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

        <div className={`mt-8 p-4 rounded-lg ${cardBg} border ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Atualização automática a cada 30 segundos</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Ativado</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
