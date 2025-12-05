import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Play, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface CheckResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

const AdminDeploymentVerificationPage: React.FC = () => {
  const { theme } = useTheme();
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
          .select('tier_name, is_active')
          .order('priority');

        if (error) throw error;

        if (data && data.length === 5) {
          results.push({
            name: 'Tier Configurations',
            status: 'success',
            message: `Found ${data.length} tier configs`,
            details: data.map(t => `${t.tier_name} (${t.is_active ? 'active' : 'inactive'})`).join(', '),
          });
        } else {
          results.push({
            name: 'Tier Configurations',
            status: 'warning',
            message: `Found ${data?.length || 0} tier configs (expected 5)`,
          });
        }
      } catch (error: any) {
        results.push({
          name: 'Tier Configurations',
          status: 'error',
          message: `Table check failed: ${error.message}`,
        });
      }

      // Check 2: Feature Flags Table
      try {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('flag_key, is_enabled')
          .like('flag_key', 'tier_%');

        if (error) throw error;

        const enabledCount = data?.filter(f => f.is_enabled).length || 0;
        results.push({
          name: 'Feature Flags',
          status: 'success',
          message: `${enabledCount}/${data?.length || 0} tier flags enabled`,
          details: data?.map(f => `${f.flag_key}: ${f.is_enabled ? 'ON' : 'OFF'}`).join(', '),
        });
      } catch (error: any) {
        results.push({
          name: 'Feature Flags',
          status: 'error',
          message: `Feature flags check failed: ${error.message}`,
        });
      }

      // Check 3: Tier Usage Stats Table
      try {
        const { data, error } = await supabase
          .from('tier_usage_stats')
          .select('count')
          .limit(1);

        if (error) throw error;

        results.push({
          name: 'Tier Usage Stats',
          status: 'success',
          message: 'Table exists and accessible',
        });
      } catch (error: any) {
        results.push({
          name: 'Tier Usage Stats',
          status: 'error',
          message: `Stats table check failed: ${error.message}`,
        });
      }

      // Check 4: Processos table has detected_tier column
      try {
        const { data, error } = await supabase
          .from('processos')
          .select('detected_tier')
          .limit(1);

        if (error) throw error;

        results.push({
          name: 'Processos Table Schema',
          status: 'success',
          message: 'detected_tier column exists',
        });
      } catch (error: any) {
        results.push({
          name: 'Processos Table Schema',
          status: 'error',
          message: `Schema check failed: ${error.message}`,
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
            name: 'Health Check Function',
            status: 'success',
            message: `System status: ${data.status}`,
            details: `${data.summary.healthy}/${data.summary.total} components healthy`,
          });
        } else {
          results.push({
            name: 'Health Check Function',
            status: 'warning',
            message: `Function responded with status ${response.status}`,
          });
        }
      } catch (error: any) {
        results.push({
          name: 'Health Check Function',
          status: 'warning',
          message: 'Function not accessible (may not be deployed yet)',
        });
      }

      // Check 6: Recent Processes
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('processos')
          .select('id, detected_tier, status')
          .gte('created_at', oneDayAgo);

        if (error) throw error;

        const withTier = data?.filter(p => p.detected_tier).length || 0;
        results.push({
          name: 'Recent Tier Detection',
          status: withTier > 0 ? 'success' : 'warning',
          message: `${withTier} processes with detected tier in last 24h`,
          details: data?.length ? `Total processes: ${data.length}` : 'No recent processes',
        });
      } catch (error: any) {
        results.push({
          name: 'Recent Tier Detection',
          status: 'warning',
          message: 'Could not check recent processes',
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
          title: 'All Checks Passed',
          message: 'System is ready for tier system deployment',
          color: '#10B981',
        };
      case 'warning':
        return {
          title: 'Checks Passed with Warnings',
          message: 'System is mostly ready, review warnings before proceeding',
          color: '#F59E0B',
        };
      case 'error':
        return {
          title: 'Checks Failed',
          message: 'Fix errors before enabling tier system',
          color: '#EF4444',
        };
      default:
        return {
          title: 'Ready to Verify',
          message: 'Click "Run Verification" to check system status',
          color: theme === 'dark' ? '#8B8B8B' : '#6B7280',
        };
    }
  };

  const statusMessage = getOverallStatusMessage();
  const successCount = checks.filter(c => c.status === 'success').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const errorCount = checks.filter(c => c.status === 'error').length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#FAFAFA' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ color: theme === 'dark' ? '#FAFAFA' : '#0F0E0D' }}>
            Deployment Verification
          </h1>
          <p className="text-sm mt-1" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
            Verify tier system components before enabling features
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
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Run Verification</span>
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
                  Passed
                </div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                  {warningCount}
                </div>
                <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                  Warnings
                </div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#0F0E0D' : '#F9FAFB' }}>
                <div className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                  {errorCount}
                </div>
                <div className="text-sm" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>
                  Failed
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
              Click "Run Verification" to check tier system deployment status
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeploymentVerificationPage;
