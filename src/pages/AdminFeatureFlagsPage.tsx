import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SidebarWis } from '../components/SidebarWis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { Flag, Users, TrendingUp, AlertTriangle, CheckCircle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface FeatureFlag {
  flag_name: string;
  enabled: boolean;
  enabled_for_users: string[] | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface TierStats {
  tier_name: string;
  total_processes: number;
  completed: number;
  failed: number;
  avg_duration: number;
  success_rate: number;
}

interface AdminFeatureFlagsPageProps {
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

export default function AdminFeatureFlagsPage({
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
}: AdminFeatureFlagsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [tierStats, setTierStats] = useState<TierStats[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await loadFlags();
    await loadTierStats();
  }

  async function loadFlags() {
    try {
      const { data, error: flagsError } = await supabase
        .from('feature_flags')
        .select('*')
        .order('flag_name');

      if (flagsError) throw flagsError;

      setFlags(data || []);

      // Initialize selected users map
      const usersMap = new Map<string, string[]>();
      data?.forEach(flag => {
        if (flag.enabled_for_users) {
          usersMap.set(flag.flag_name, flag.enabled_for_users);
        }
      });
      setSelectedUsers(usersMap);

      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadTierStats() {
    try {
      const { data, error: statsError } = await supabase
        .from('processos')
        .select('tier_name, status, created_at, updated_at')
        .not('tier_name', 'is', null)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (statsError) throw statsError;

      // Calculate stats per tier
      const statsMap = new Map<string, TierStats>();

      data?.forEach(processo => {
        const tier = processo.tier_name!;
        if (!statsMap.has(tier)) {
          statsMap.set(tier, {
            tier_name: tier,
            total_processes: 0,
            completed: 0,
            failed: 0,
            avg_duration: 0,
            success_rate: 0,
          });
        }

        const stats = statsMap.get(tier)!;
        stats.total_processes++;

        if (processo.status === 'completed') stats.completed++;
        if (processo.status === 'error') stats.failed++;

        // Calculate duration
        const duration = new Date(processo.updated_at).getTime() - new Date(processo.created_at).getTime();
        stats.avg_duration += duration / (1000 * 60); // Convert to minutes
      });

      // Finalize calculations
      const statsArray: TierStats[] = [];
      statsMap.forEach(stats => {
        stats.avg_duration = stats.avg_duration / stats.total_processes;
        stats.success_rate = (stats.completed / stats.total_processes) * 100;
        statsArray.push(stats);
      });

      setTierStats(statsArray);
    } catch (err: any) {
      console.error('Error loading tier stats:', err);
    }
  }

  async function toggleFlag(flagName: string, currentValue: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('feature_flags')
        .update({ enabled: !currentValue })
        .eq('flag_name', flagName);

      if (updateError) throw updateError;

      setSuccess(`Feature flag "${flagName}" ${!currentValue ? 'enabled' : 'disabled'} successfully!`);
      await loadFlags();

      // Auto-clear success message
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function quickRollback() {
    if (!confirm('⚠️ This will disable ALL tier flags immediately. Are you sure?')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Disable all tier-related flags
      const { error: rollbackError } = await supabase
        .from('feature_flags')
        .update({ enabled: false })
        .like('flag_name', 'tier_%');

      if (rollbackError) throw rollbackError;

      setSuccess('🚨 EMERGENCY ROLLBACK COMPLETE! All tier flags disabled.');
      await loadFlags();

      setTimeout(() => setSuccess(null), 10000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function enableStage(stage: number) {
    const stages = [
      { stage: 1, flags: ['tier_system_enabled', 'tier_system_small'], name: 'Stage 1: SMALL tier (5% rollout)' },
      { stage: 2, flags: ['tier_system_enabled', 'tier_system_small', 'tier_system_medium'], name: 'Stage 2: + MEDIUM (25% rollout)' },
      { stage: 3, flags: ['tier_system_enabled', 'tier_system_small', 'tier_system_medium', 'tier_system_large'], name: 'Stage 3: + LARGE (50% rollout)' },
      { stage: 4, flags: ['tier_system_enabled', 'tier_system_small', 'tier_system_medium', 'tier_system_large', 'tier_system_xlarge'], name: 'Stage 4: + XLARGE (75% rollout)' },
      { stage: 5, flags: ['tier_system_enabled', 'tier_system_small', 'tier_system_medium', 'tier_system_large', 'tier_system_xlarge', 'tier_system_massive'], name: 'Stage 5: ALL tiers (100% rollout)' },
    ];

    const stageConfig = stages.find(s => s.stage === stage);
    if (!stageConfig) return;

    if (!confirm(`Enable ${stageConfig.name}?\n\nThis will enable multiple tier flags. Monitor carefully!`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Enable specified flags
      for (const flagName of stageConfig.flags) {
        const { error } = await supabase
          .from('feature_flags')
          .update({ enabled: true })
          .eq('flag_name', flagName);

        if (error) throw error;
      }

      setSuccess(`✅ ${stageConfig.name} enabled! Monitor at /admin-tier-monitoring`);
      await loadFlags();

      setTimeout(() => setSuccess(null), 10000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function refreshData() {
    setLoading(true);
    await loadFlags();
    await loadTierStats();
    setLoading(false);
  }

  const masterFlag = flags.find(f => f.flag_name === 'tier_system_enabled');
  const tierFlags = flags.filter(f => f.flag_name.startsWith('tier_system_') && f.flag_name !== 'tier_system_enabled');

  if (loading) {
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
            window.history.pushState({}, '', '/signature');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onCollapsedChange={setIsSidebarCollapsed}
          onSearchClick={() => {}}
        />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <LoadingSpinner size="lg" />
        </main>
      </div>
    );
  }

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
          window.history.pushState({}, '', '/signature');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onCollapsedChange={setIsSidebarCollapsed}
        onSearchClick={() => {}}
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/profile#admin');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-7xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </button>

          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <Flag className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <h1 className="text-3xl font-bold" style={{ color: colors.textPrimary }}>
                    Feature Flags Management
                  </h1>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    Control tier-aware processing rollout
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={refreshData}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: colors.textPrimary,
                    borderColor: theme === 'dark' ? '#4B5563' : '#D1D5DB'
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={quickRollback}
                  disabled={saving || !masterFlag?.enabled}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Emergency Rollback</span>
                </button>
              </div>
            </div>

            {/* Success/Error Messages */}
            {success && (
              <div className="mb-6 p-4 border rounded-lg flex items-start space-x-3" style={{
                backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : '#F0FDF4',
                borderColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.3)' : '#BBF7D0'
              }}>
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: theme === 'dark' ? '#BBF7D0' : '#166534' }}>{success}</p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 border rounded-lg flex items-start space-x-3" style={{
                backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                borderColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : '#FECACA'
              }}>
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm" style={{ color: theme === 'dark' ? '#FECACA' : '#991B1B' }}>{error}</p>
              </div>
            )}

            {/* Master Flag */}
            <div className="mb-8 border-2 rounded-lg p-6" style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
              borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg`} style={{
                    backgroundColor: masterFlag?.enabled
                      ? (theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7')
                      : colors.bgSecondary
                  }}>
                    <Flag className={`h-6 w-6 ${masterFlag?.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                      Master Switch: Tier System
                    </h2>
                    <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                      {masterFlag?.description || 'Master switch for tier-aware processing system'}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs" style={{ color: colors.textSecondary }}>
                        Status: <strong className={masterFlag?.enabled ? 'text-green-600' : ''}>
                          {masterFlag?.enabled ? 'ACTIVE' : 'INACTIVE'}
                        </strong>
                      </span>
                      {masterFlag?.enabled_for_users && masterFlag.enabled_for_users.length > 0 && (
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          <Users className="h-3 w-3 inline mr-1" />
                          {masterFlag.enabled_for_users.length} user(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleFlag(masterFlag?.flag_name || '', masterFlag?.enabled || false)}
                  disabled={saving}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    masterFlag?.enabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {masterFlag?.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Quick Rollout Stages */}
            <div className="mb-8 rounded-lg shadow-md p-6" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    Quick Rollout Stages
                  </h3>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    Enable tier flags progressively (recommended for production rollout)
                  </p>
                </div>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <button
              onClick={() => enableStage(1)}
              disabled={saving}
              className="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1">
                Stage 1
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                SMALL tier
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                5% rollout
              </div>
            </button>

            <button
              onClick={() => enableStage(2)}
              disabled={saving}
              className="p-4 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                Stage 2
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                + MEDIUM
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                25% rollout
              </div>
            </button>

            <button
              onClick={() => enableStage(3)}
              disabled={saving}
              className="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-1">
                Stage 3
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                + LARGE
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                50% rollout
              </div>
            </button>

            <button
              onClick={() => enableStage(4)}
              disabled={saving}
              className="p-4 border-2 border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                Stage 4
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                + XLARGE
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                75% rollout
              </div>
            </button>

            <button
              onClick={() => enableStage(5)}
              disabled={saving}
              className="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-1">
                Stage 5
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                + MASSIVE
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                100% rollout
              </div>
            </button>
          </div>

              <div className="mt-4 p-3 rounded-lg" style={{
                backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF'
              }}>
                <p className="text-xs" style={{ color: theme === 'dark' ? '#BFDBFE' : '#1E40AF' }}>
                  💡 <strong>Tip:</strong> Enable stages progressively and monitor at{' '}
                  <a href="/admin-tier-monitoring" className="underline font-semibold">
                    /admin-tier-monitoring
                  </a>{' '}
                  between each stage. Wait 24-48h between stages in production.
                </p>
              </div>
            </div>

            {/* Tier Stats Overview */}
            {tierStats.length > 0 && (
              <div className="mb-8 rounded-lg shadow-md p-6" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-center space-x-3 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    Tier Performance (Last 7 Days)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {tierStats.map(stats => (
                    <div
                      key={stats.tier_name}
                      className="rounded-lg p-4 border"
                      style={{
                        backgroundColor: theme === 'dark' ? '#374151' : '#F9FAFB',
                        borderColor: theme === 'dark' ? '#4B5563' : '#E5E7EB'
                      }}
                    >
                      <div className="text-xs font-semibold uppercase mb-2" style={{ color: colors.textSecondary }}>
                        {stats.tier_name}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: colors.textSecondary }}>Total:</span>
                          <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                            {stats.total_processes}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: colors.textSecondary }}>Success:</span>
                          <span className="text-sm font-semibold text-green-600">
                            {stats.success_rate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: colors.textSecondary }}>Avg Time:</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {stats.avg_duration.toFixed(0)}m
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tier Flags */}
            <div className="rounded-lg shadow-md" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                  Tier-Specific Flags
                </h3>
                <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                  Control which tiers are active (master switch must be enabled first)
                </p>
              </div>

              <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                {tierFlags.map(flag => {
                  const tierName = flag.flag_name.replace('tier_system_', '').toUpperCase();
                  const isBlocked = !masterFlag?.enabled;

                  return (
                    <div key={flag.flag_name} className="px-6 py-4 hover:opacity-90 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${flag.enabled && !isBlocked ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div>
                              <h4 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                                {tierName} Tier
                              </h4>
                              <p className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                                {flag.description || `Enable tier system for ${tierName} files (2001-5000 pages)`}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          {flag.enabled_for_users && flag.enabled_for_users.length > 0 && (
                            <span className="text-xs flex items-center space-x-1" style={{ color: colors.textSecondary }}>
                              <Users className="h-3 w-3" />
                              <span>{flag.enabled_for_users.length}</span>
                            </span>
                          )}

                          <button
                            onClick={() => toggleFlag(flag.flag_name, flag.enabled)}
                            disabled={saving || isBlocked}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              flag.enabled && !isBlocked
                                ? 'bg-green-600'
                                : 'bg-gray-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={isBlocked ? 'Master switch must be enabled first' : ''}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                flag.enabled && !isBlocked ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Documentation Link */}
            <div className="mt-8 border rounded-lg p-6" style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
              borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE'
            }}>
              <h4 className="text-sm font-semibold mb-2" style={{ color: theme === 'dark' ? '#BFDBFE' : '#1E40AF' }}>
                📚 Need help?
              </h4>
              <p className="text-sm" style={{ color: theme === 'dark' ? '#BFDBFE' : '#1E40AF' }}>
                Check the{' '}
                <a
                  href="/docs/TIER_SYSTEM_OVERVIEW.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:opacity-80"
                >
                  Tier System Documentation
                </a>{' '}
                for detailed rollout strategies, monitoring queries, and troubleshooting guides.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
