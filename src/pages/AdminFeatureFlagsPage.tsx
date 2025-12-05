import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import { Flag, Users, TrendingUp, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

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

export default function AdminFeatureFlagsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [tierStats, setTierStats] = useState<TierStats[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, [user]);

  async function checkAdminAndLoadData() {
    if (!user) {
      navigate('/signin');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      navigate('/');
      return;
    }

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
    if (!confirm('⚠️ This will disable the ENTIRE tier system. Are you sure?')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: rollbackError } = await supabase
        .from('feature_flags')
        .update({ enabled: false })
        .eq('flag_name', 'tier_system_enabled');

      if (rollbackError) throw rollbackError;

      setSuccess('🚨 TIER SYSTEM DISABLED! All new processes will use legacy flow.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const masterFlag = flags.find(f => f.flag_name === 'tier_system_enabled');
  const tierFlags = flags.filter(f => f.flag_name.startsWith('tier_system_') && f.flag_name !== 'tier_system_enabled');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Flag className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Feature Flags Management
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Control tier-aware processing rollout
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={refreshData}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Master Flag */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${masterFlag?.enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <Flag className={`h-6 w-6 ${masterFlag?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Master Switch: Tier System
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {masterFlag?.description || 'Enable/disable entire tier-aware processing system'}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Status: <strong className={masterFlag?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                      {masterFlag?.enabled ? 'ACTIVE' : 'INACTIVE'}
                    </strong>
                  </span>
                  {masterFlag?.enabled_for_users && masterFlag.enabled_for_users.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
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

        {/* Tier Stats Overview */}
        {tierStats.length > 0 && (
          <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tier Performance (Last 7 Days)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {tierStats.map(stats => (
                <div
                  key={stats.tier_name}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                    {stats.tier_name}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-300">Total:</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {stats.total_processes}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-300">Success:</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {stats.success_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-gray-300">Avg Time:</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tier-Specific Flags
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Control which tiers are active (master switch must be enabled first)
            </p>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tierFlags.map(flag => {
              const tierName = flag.flag_name.replace('tier_system_', '').toUpperCase();
              const isBlocked = !masterFlag?.enabled;

              return (
                <div key={flag.flag_name} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${flag.enabled && !isBlocked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {tierName} Tier
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {flag.description || `Enable tier-aware processing for ${tierName} files`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {flag.enabled_for_users && flag.enabled_for_users.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-1">
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
                            : 'bg-gray-200 dark:bg-gray-700'
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
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            📚 Need help?
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Check the{' '}
            <a
              href="/docs/TIER_SYSTEM_OVERVIEW.md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:text-blue-600 dark:hover:text-blue-300"
            >
              Tier System Documentation
            </a>{' '}
            for detailed rollout strategies, monitoring queries, and troubleshooting guides.
          </p>
        </div>
      </div>
    </div>
  );
}
