import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, TrendingUp, RefreshCw, ArrowLeft } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: ComponentHealth;
    featureFlags: ComponentHealth;
    tierConfigs: ComponentHealth;
    edgeFunctions: ComponentHealth;
    recentProcessing: ComponentHealth;
  };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: any;
  latencyMs?: number;
}

interface TierStats {
  tier_name: string;
  total_processes: number;
  successful_processes: number;
  failed_processes: number;
  avg_processing_time_seconds: number;
  date: string;
}

interface AdminTierMonitoringPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminTierMonitoringPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminTierMonitoringPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [tierStats, setTierStats] = useState<TierStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealthCheck = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tier-system-health-check`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setHealthCheck(data);
    } catch (error) {
      console.error('Failed to fetch health check:', error);
    }
  };

  const fetchTierStats = async () => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('tier_usage_stats')
        .select('*')
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: false });

      if (error) throw error;

      setTierStats(data || []);
    } catch (error) {
      console.error('Failed to fetch tier stats:', error);
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchHealthCheck(), fetchTierStats()]);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#10B981';
      case 'degraded':
        return '#F59E0B';
      case 'unhealthy':
        return '#EF4444';
      default:
        return theme === 'dark' ? '#6B7280' : '#9CA3AF';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" style={{ color: getStatusColor(status) }} />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5" style={{ color: getStatusColor(status) }} />;
      case 'unhealthy':
        return <AlertCircle className="w-5 h-5" style={{ color: getStatusColor(status) }} />;
      default:
        return <Activity className="w-5 h-5" style={{ color: getStatusColor(status) }} />;
    }
  };

  const aggregateStatsByTier = () => {
    const aggregated: Record<string, { total: number; successful: number; failed: number; avgTime: number; count: number }> = {};

    tierStats.forEach((stat) => {
      if (!aggregated[stat.tier_name]) {
        aggregated[stat.tier_name] = {
          total: 0,
          successful: 0,
          failed: 0,
          avgTime: 0,
          count: 0,
        };
      }

      aggregated[stat.tier_name].total += stat.total_processes || 0;
      aggregated[stat.tier_name].successful += stat.successful_processes || 0;
      aggregated[stat.tier_name].failed += stat.failed_processes || 0;
      aggregated[stat.tier_name].avgTime += stat.avg_processing_time_seconds || 0;
      aggregated[stat.tier_name].count += 1;
    });

    return Object.entries(aggregated).map(([tierName, stats]) => ({
      tierName,
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      avgTime: stats.count > 0 ? stats.avgTime / stats.count : 0,
      successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
    }));
  };

  const aggregatedStats = aggregateStatsByTier();

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={() => {
          window.history.pushState({}, '', '/notifications');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToTokens={() => {
          window.history.pushState({}, '', '/tokens');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToSubscription={() => {
          window.history.pushState({}, '', '/subscription');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button
              onClick={onNavigateToAdmin}
              className="flex items-center gap-2 mb-6 px-4 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Admin</span>
            </button>

            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                  Monitoramento do Sistema de Níveis
                </h1>
                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  Métricas de saúde e desempenho em tempo real
                </p>
              </div>

              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="text-xs mb-4" style={{ color: colors.textSecondary }}>
              Última atualização: {lastRefresh.toLocaleTimeString()}
            </div>

            {healthCheck && (
              <>
                <div
                  className="rounded-xl p-6 mb-6"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    border: `2px solid ${getStatusColor(healthCheck.status)}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(healthCheck.status)}
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                          Status Geral: {healthCheck.status.toUpperCase()}
                        </h2>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          {healthCheck.summary.healthy}/{healthCheck.summary.total} componentes saudáveis
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="text-2xl font-bold" style={{ color: '#10B981' }}>
                        {healthCheck.summary.healthy}
                      </div>
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        Saudável
                      </div>
                    </div>
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                        {healthCheck.summary.degraded}
                      </div>
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        Degradado
                      </div>
                    </div>
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                        {healthCheck.summary.unhealthy}
                      </div>
                      <div className="text-sm" style={{ color: colors.textSecondary }}>
                        Não Saudável
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {Object.entries(healthCheck.checks).map(([key, check]) => (
                    <div
                      key={key}
                      className="rounded-xl p-6"
                      style={{
                        backgroundColor: colors.bgSecondary,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(check.status)}
                          <h3 className="font-semibold capitalize" style={{ color: colors.textPrimary }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </h3>
                        </div>
                        {check.latencyMs && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: colors.textSecondary }}>
                            <Clock className="w-3 h-3" />
                            {check.latencyMs}ms
                          </div>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        {check.message}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div
              className="rounded-xl p-6 mb-6"
              style={{
                backgroundColor: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5" style={{ color: colors.textPrimary }} />
                <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                  Desempenho por Nível (Últimos 7 Dias)
                </h2>
              </div>

              {aggregatedStats.length === 0 ? (
                <p className="text-center py-8" style={{ color: colors.textSecondary }}>
                  Nenhuma estatística de nível disponível ainda
                </p>
              ) : (
                <div className="space-y-4">
                  {aggregatedStats.map((stat) => (
                    <div
                      key={stat.tierName}
                      className="p-4 rounded-lg"
                      style={{ backgroundColor: colors.bgPrimary }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold" style={{ color: colors.textPrimary }}>
                          {stat.tierName}
                        </h3>
                        <div className="flex items-center gap-4 text-sm">
                          <span style={{ color: colors.textSecondary }}>
                            Total: <span className="font-semibold">{stat.total}</span>
                          </span>
                          <span style={{ color: '#10B981' }}>
                            Sucesso: <span className="font-semibold">{stat.successful}</span>
                          </span>
                          <span style={{ color: '#EF4444' }}>
                            Falhas: <span className="font-semibold">{stat.failed}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span style={{ color: colors.textSecondary }}>Taxa de Sucesso</span>
                            <span className="font-semibold" style={{ color: colors.textPrimary }}>
                              {stat.successRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full" style={{ backgroundColor: colors.border }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${stat.successRate}%`,
                                backgroundColor: stat.successRate >= 95 ? '#10B981' : stat.successRate >= 80 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div style={{ color: colors.textSecondary }}>Tempo Médio</div>
                          <div className="font-semibold" style={{ color: colors.textPrimary }}>
                            {stat.avgTime.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>
    </div>
  );
}

export default AdminTierMonitoringPage;
