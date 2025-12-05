import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
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

const AdminTierMonitoringPage: React.FC = () => {
  const { theme } = useTheme();
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
    <div className="min-h-screen" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#FAFAFA' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
              Tier System Monitoring
            </h1>
            <p className="text-sm mt-1" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
              Real-time health and performance metrics
            </p>
          </div>

          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
              color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D',
              border: `1px solid ${theme === 'dark' ? '#2D2C2B' : '#E5E7EB'}`,
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="text-xs mb-4" style={{ color: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>

        {healthCheck && (
          <>
            <div
              className="rounded-xl p-6 mb-6"
              style={{
                backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
                border: `2px solid ${getStatusColor(healthCheck.status)}`,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthCheck.status)}
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                      Overall Status: {healthCheck.status.toUpperCase()}
                    </h2>
                    <p className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                      {healthCheck.summary.healthy}/{healthCheck.summary.total} components healthy
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                  <div className="text-2xl font-bold" style={{ color: '#10B981' }}>
                    {healthCheck.summary.healthy}
                  </div>
                  <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                    Healthy
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                  <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                    {healthCheck.summary.degraded}
                  </div>
                  <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                    Degraded
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                  <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                    {healthCheck.summary.unhealthy}
                  </div>
                  <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                    Unhealthy
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
                    backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#2D2C2B' : '#E5E7EB'}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.status)}
                      <h3 className="font-semibold capitalize" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h3>
                    </div>
                    {check.latencyMs && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                        <Clock className="w-3 h-3" />
                        {check.latencyMs}ms
                      </div>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: theme === 'dark' ? '#C8C8C8' : '#4B5563' }}>
                    {check.message}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
            border: `1px solid ${theme === 'dark' ? '#2D2C2B' : '#E5E7EB'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }} />
            <h2 className="text-xl font-bold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
              Tier Performance (Last 7 Days)
            </h2>
          </div>

          {aggregatedStats.length === 0 ? (
            <p className="text-center py-8" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
              No tier statistics available yet
            </p>
          ) : (
            <div className="space-y-4">
              {aggregatedStats.map((stat) => (
                <div
                  key={stat.tierName}
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                      {stat.tierName}
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                        Total: <span className="font-semibold">{stat.total}</span>
                      </span>
                      <span style={{ color: '#10B981' }}>
                        Success: <span className="font-semibold">{stat.successful}</span>
                      </span>
                      <span style={{ color: '#EF4444' }}>
                        Failed: <span className="font-semibold">{stat.failed}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>Success Rate</span>
                        <span className="font-semibold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
                          {stat.successRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: theme === 'dark' ? '#2D2C2B' : '#E5E7EB' }}>
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
                      <div style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>Avg Time</div>
                      <div className="font-semibold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
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
  );
};

export default AdminTierMonitoringPage;
