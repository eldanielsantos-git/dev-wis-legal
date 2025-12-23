import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';

interface CheckResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

interface AdminDeploymentVerificationPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

const AdminDeploymentVerificationPage: React.FC<AdminDeploymentVerificationPageProps> = ({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'pending' | 'success' | 'error' | 'warning'>('pending');

  const runVerification = async () => {
    setRunning(true);
    setChecks([]);
    const results: CheckResult[] = [];

    try {
      // Check 1: Tier Config Table
      try {
        const { data, error } = await supabase
          .from('processing_tier_config')
          .select('tier_name, active')
          .order('tier_name');

        if (error) throw error;

        if (data && data.length === 5) {
          results.push({
            name: 'Configurações de Nível',
            status: 'success',
            message: `Encontradas ${data.length} configurações de nível`,
            details: data.map(t => `${t.tier_name} (${t.active ? 'ativo' : 'inativo'})`).join(', '),
          });
        } else {
          results.push({
            name: 'Configurações de Nível',
            status: 'warning',
            message: `Encontradas ${data?.length || 0} configurações (esperado 5)`,
          });
        }
      } catch (error: any) {
        results.push({
          name: 'Configurações de Nível',
          status: 'error',
          message: `Verificação de tabela falhou: ${error.message}`,
        });
      }

      // Check 2: Feature Flags Table
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_name, enabled')
          .like('flag_name', 'tier_%');

        if (error) throw error;

        const enabledCount = data?.filter(f => f.enabled).length || 0;
        results.push({
          name: 'Feature Flags',
          status: 'success',
          message: `${enabledCount}/${data?.length || 0} flags de nível ativadas`,
          details: data?.map(f => `${f.flag_name}: ${f.enabled ? 'ATIVA' : 'INATIVA'}`).join(', '),
        });
      } catch (error: any) {
        results.push({
          name: 'Feature Flags',
          status: 'error',
          message: `Verificação de feature flags falhou: ${error.message}`,
        });
      }

      // Check 3: Tier Usage Stats Table
      try {
        const { data, error } = await supabase
          .from('tier_usage_stats')
          .select('id')
          .limit(1);

        if (error) throw error;

        results.push({
          name: 'Estatísticas de Uso por Nível',
          status: 'success',
          message: 'Tabela existe e está acessível',
        });
      } catch (error: any) {
        results.push({
          name: 'Estatísticas de Uso por Nível',
          status: 'error',
          message: `Verificação de tabela falhou: ${error.message}`,
        });
      }

      // Check 4: Processos table has tier_info column
      try {
        const { data, error } = await supabase
          .from('processos')
          .select('tier_info')
          .limit(1);

        if (error) throw error;

        results.push({
          name: 'Esquema da Tabela Processos',
          status: 'success',
          message: 'Coluna tier_info existe',
        });
      } catch (error: any) {
        results.push({
          name: 'Esquema da Tabela Processos',
          status: 'error',
          message: `Verificação de esquema falhou: ${error.message}`,
        });
      }

      // Check 5: Health Check Function
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tier-system-health-check`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          results.push({
            name: 'Função de Verificação de Saúde',
            status: 'success',
            message: `Status do sistema: ${data.status}`,
            details: `${data.summary.healthy}/${data.summary.total} componentes saudáveis`,
          });
        } else {
          results.push({
            name: 'Função de Verificação de Saúde',
            status: 'warning',
            message: `Função respondeu com status ${response.status}`,
          });
        }
      } catch (error: any) {
        results.push({
          name: 'Função de Verificação de Saúde',
          status: 'warning',
          message: 'Função não acessível (pode não estar implantada ainda)',
        });
      }

      // Check 6: Recent Processes
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('processos')
          .select('id, tier_info, status')
          .gte('created_at', oneDayAgo);

        if (error) throw error;

        const withTier = data?.filter(p => p.tier_info && p.tier_info.tier).length || 0;
        results.push({
          name: 'Detecção Recente de Nível',
          status: withTier > 0 ? 'success' : 'warning',
          message: `${withTier} processos com nível detectado nas últimas 24h`,
          details: data?.length ? `Total de processos: ${data.length}` : 'Nenhum processo recente',
        });
      } catch (error: any) {
        results.push({
          name: 'Detecção Recente de Nível',
          status: 'warning',
          message: 'Não foi possível verificar processos recentes',
        });
      }

      setChecks(results);

      // Calculate overall status
      const hasError = results.some(r => r.status === 'error');
      const hasWarning = results.some(r => r.status === 'warning');

      if (hasError) {
        setOverallStatus('error');
      } else if (hasWarning) {
        setOverallStatus('warning');
      } else {
        setOverallStatus('success');
      }
    } catch (error) {
      console.error('Verification failed:', error);
      setOverallStatus('error');
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />;
      case 'error':
        return <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" style={{ color: '#F59E0B' }} />;
      default:
        return null;
    }
  };

  const getOverallStatusMessage = () => {
    switch (overallStatus) {
      case 'success':
        return {
          title: 'Todas as Verificações Passaram',
          message: 'Sistema pronto para implantação do sistema de níveis',
          color: '#10B981',
        };
      case 'warning':
        return {
          title: 'Verificações Passaram com Avisos',
          message: 'Sistema está quase pronto, revise os avisos antes de prosseguir',
          color: '#F59E0B',
        };
      case 'error':
        return {
          title: 'Verificações Falharam',
          message: 'Corrija os erros antes de ativar o sistema de níveis',
          color: '#EF4444',
        };
      default:
        return {
          title: 'Pronto para Verificar',
          message: 'Clique em "Executar Verificação" para verificar o status do sistema',
          color: theme === 'dark' ? '#8B8B8B' : '#6B7280',
        };
    }
  };

  const statusMessage = getOverallStatusMessage();
  const successCount = checks.filter(c => c.status === 'success').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const errorCount = checks.filter(c => c.status === 'error').length;

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
        onCollapsedChange={setIsSidebarCollapsed}
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
              Verificação de Implantação
            </h1>
            <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
              Verifique os componentes do sistema de níveis antes de ativar as funcionalidades
            </p>
          </div>

        <div
          className="rounded-xl p-6 mb-6"
          style={{
            backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
            border: `2px solid ${statusMessage.color}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                {statusMessage.title}
              </h2>
              <p style={{ color: theme === 'dark' ? '#C8C8C8' : '#4B5563' }}>{statusMessage.message}</p>
            </div>

            <button
              onClick={runVerification}
              disabled={running}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: running ? (theme === 'dark' ? '#2D2C2B' : '#E5E7EB') : '#2563EB',
                color: '#FFFFFF',
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Executar Verificação</span>
                </>
              )}
            </button>
          </div>

          {checks.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                <div className="text-2xl font-bold" style={{ color: '#10B981' }}>
                  {successCount}
                </div>
                <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                  Aprovadas
                </div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                  {warningCount}
                </div>
                <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                  Avisos
                </div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                  {errorCount}
                </div>
                <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                  Falharam
                </div>
              </div>
            </div>
          )}
        </div>

        {checks.length > 0 && (
          <div className="space-y-4">
            {checks.map((check, index) => (
              <div
                key={index}
                className="rounded-xl p-4"
                style={{
                  backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
                  border: `1px solid ${theme === 'dark' ? '#2D2C2B' : '#E5E7EB'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(check.status)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                      {check.name}
                    </h3>
                    <p className="text-sm" style={{ color: theme === 'dark' ? '#C8C8C8' : '#4B5563' }}>
                      {check.message}
                    </p>
                    {check.details && (
                      <p className="text-xs mt-2 font-mono" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                        {check.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {checks.length === 0 && !running && (
          <div
            className="text-center py-12 rounded-xl"
            style={{
              backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
              border: `1px solid ${theme === 'dark' ? '#2D2C2B' : '#E5E7EB'}`,
            }}
          >
            <p style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
              Clique em "Executar Verificação" para verificar o status de implantação do sistema de níveis
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default AdminDeploymentVerificationPage;
