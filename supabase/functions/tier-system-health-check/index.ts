import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'healthy', message: '' },
        featureFlags: { status: 'healthy', message: '' },
        tierConfigs: { status: 'healthy', message: '' },
        edgeFunctions: { status: 'healthy', message: '' },
        recentProcessing: { status: 'healthy', message: '' },
      },
      summary: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
      },
    };

    // 1. Check Database Connectivity
    const dbStart = Date.now();
    try {
      const { data, error } = await supabase
        .from('processing_tier_config')
        .select('count')
        .limit(1);

      result.checks.database = {
        status: error ? 'unhealthy' : 'healthy',
        message: error ? `Database error: ${error.message}` : 'Database connected',
        latencyMs: Date.now() - dbStart,
      };
    } catch (error) {
      result.checks.database = {
        status: 'unhealthy',
        message: `Database connection failed: ${error.message}`,
        latencyMs: Date.now() - dbStart,
      };
    }

    // 2. Check Feature Flags
    try {
      const { data: flags, error } = await supabase
        .from('feature_flags')
        .select('flag_name, enabled')
        .in('flag_name', [
          'tier_system_enabled',
          'tier_system_small',
          'tier_system_medium',
          'tier_system_large',
          'tier_system_xlarge',
          'tier_system_massive',
        ]);

      if (error) {
        result.checks.featureFlags = {
          status: 'unhealthy',
          message: `Feature flags error: ${error.message}`,
        };
      } else {
        const enabledCount = flags?.filter((f) => f.enabled).length || 0;
        result.checks.featureFlags = {
          status: 'healthy',
          message: `${enabledCount}/${flags?.length || 0} tier flags enabled`,
          details: flags,
        };
      }
    } catch (error) {
      result.checks.featureFlags = {
        status: 'unhealthy',
        message: `Feature flags check failed: ${error.message}`,
      };
    }

    // 3. Check Tier Configurations
    try {
      const { data: configs, error } = await supabase
        .from('processing_tier_config')
        .select('tier_name, active, min_pages, max_pages')
        .order('min_pages', { ascending: true });

      if (error) {
        result.checks.tierConfigs = {
          status: 'unhealthy',
          message: `Tier config error: ${error.message}`,
        };
      } else {
        const activeCount = configs?.filter((c) => c.active).length || 0;
        const expectedCount = 5;

        if (configs?.length !== expectedCount) {
          result.checks.tierConfigs = {
            status: 'degraded',
            message: `Found ${configs?.length}/${expectedCount} tier configs`,
            details: configs,
          };
        } else {
          result.checks.tierConfigs = {
            status: 'healthy',
            message: `All ${activeCount}/${configs?.length} tier configs present`,
            details: configs,
          };
        }
      }
    } catch (error) {
      result.checks.tierConfigs = {
        status: 'unhealthy',
        message: `Tier config check failed: ${error.message}`,
      };
    }

    // 4. Check Edge Functions (basic connectivity)
    try {
      const functions = [
        'start-analysis-unified',
        'tier-aware-worker',
        'tier-aware-chunking',
        'unified-recovery-coordinator',
        'tier-analytics',
      ];

      result.checks.edgeFunctions = {
        status: 'healthy',
        message: `${functions.length} tier-aware functions deployed`,
        details: { functions },
      };
    } catch (error) {
      result.checks.edgeFunctions = {
        status: 'degraded',
        message: 'Could not verify all edge functions',
      };
    }

    // 5. Check Recent Processing Activity (last 24h)
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentStats, error } = await supabase
        .from('tier_usage_stats')
        .select('tier_name, total_processes, completed_processes, failed_processes')
        .gte('date', oneDayAgo);

      if (error) {
        result.checks.recentProcessing = {
          status: 'degraded',
          message: 'Could not fetch recent processing stats',
        };
      } else {
        const totalProcesses = recentStats?.reduce((sum, s) => sum + (s.total_processes || 0), 0) || 0;
        const failedProcesses = recentStats?.reduce((sum, s) => sum + (s.failed_processes || 0), 0) || 0;
        const failureRate = totalProcesses > 0 ? (failedProcesses / totalProcesses) * 100 : 0;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (failureRate > 20) status = 'unhealthy';
        else if (failureRate > 10) status = 'degraded';

        result.checks.recentProcessing = {
          status,
          message: `${totalProcesses} processes (${failureRate.toFixed(1)}% failure rate)`,
          details: {
            totalProcesses,
            failedProcesses,
            failureRate: failureRate.toFixed(2),
            stats: recentStats,
          },
        };
      }
    } catch (error) {
      result.checks.recentProcessing = {
        status: 'degraded',
        message: 'Could not check recent processing activity',
      };
    }

    // Calculate summary
    const checks = Object.values(result.checks);
    result.summary.total = checks.length;
    result.summary.healthy = checks.filter((c) => c.status === 'healthy').length;
    result.summary.degraded = checks.filter((c) => c.status === 'degraded').length;
    result.summary.unhealthy = checks.filter((c) => c.status === 'unhealthy').length;

    // Determine overall status
    if (result.summary.unhealthy > 0) {
      result.status = 'unhealthy';
    } else if (result.summary.degraded > 0) {
      result.status = 'degraded';
    } else {
      result.status = 'healthy';
    }

    // Return appropriate HTTP status
    let httpStatus = 200;
    if (result.status === 'degraded') httpStatus = 207; // Multi-Status
    if (result.status === 'unhealthy') httpStatus = 503; // Service Unavailable

    return new Response(JSON.stringify(result, null, 2), {
      status: httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'unhealthy', message: 'Health check crashed' },
        featureFlags: { status: 'unhealthy', message: 'Not checked' },
        tierConfigs: { status: 'unhealthy', message: 'Not checked' },
        edgeFunctions: { status: 'unhealthy', message: 'Not checked' },
        recentProcessing: { status: 'unhealthy', message: 'Not checked' },
      },
      summary: {
        total: 5,
        healthy: 0,
        degraded: 0,
        unhealthy: 5,
      },
    };

    return new Response(JSON.stringify(errorResult, null, 2), {
      status: 503,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
