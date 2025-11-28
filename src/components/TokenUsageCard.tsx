import { useEffect, useState } from 'react';
import { tokenService, type TokenUsageSummary } from '../services/TokenService';
import { supabase } from '../lib/supabase';
import { Activity, TrendingUp, Clock, AlertCircle, FileText } from 'lucide-react';

interface RecentProcess {
  id: string;
  file_name: string;
  tokens_consumed: number;
  pages_processed_successfully: number;
  created_at: string;
}

interface TokenUsageCardProps {
  userId: string;
  compact?: boolean;
}

export function TokenUsageCard({ userId, compact = false }: TokenUsageCardProps) {
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [recentProcesses, setRecentProcesses] = useState<RecentProcess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenUsage();
    if (!compact) {
      loadRecentProcesses();
    }

    const interval = setInterval(() => {
      loadTokenUsage();
      if (!compact) {
        loadRecentProcesses();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [userId, compact]);

  const loadTokenUsage = async () => {
    const data = await tokenService.getUserTokenUsageSummary(userId);
    setSummary(data);
    setLoading(false);
  };

  const loadRecentProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('processos')
        .select('id, file_name, tokens_consumed, pages_processed_successfully, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gt('tokens_consumed', 0)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentProcesses(data || []);
    } catch (error) {
      console.error('Error loading recent processes:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <p className="text-gray-500 dark:text-gray-400">Erro ao carregar dados de uso de tokens</p>
      </div>
    );
  }

  const usagePercent = tokenService.getUsagePercentage(
    summary.tokens_this_month,
    summary.monthly_quota
  );
  const usageColor = tokenService.getUsageColor(usagePercent);
  const barColor = tokenService.getUsageBarColor(usagePercent);

  const resetDate = new Date(summary.quota_reset_date);
  const daysUntilReset = Math.ceil(
    (resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (compact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tokens este mês
            </span>
          </div>
          {usagePercent >= 90 && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${usageColor}`}>
              {tokenService.formatTokenCount(summary.tokens_this_month)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              de {tokenService.formatTokenCount(summary.monthly_quota)}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`${barColor} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{usagePercent.toFixed(1)}% usado</span>
            <span>Reinicia em {daysUntilReset}d</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Uso de Tokens
        </h3>
        {usagePercent >= 90 && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Limite próximo</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold ${usageColor}`}>
              {tokenService.formatTokenCount(summary.tokens_this_month)}
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400">
              / {tokenService.formatTokenCount(summary.monthly_quota)}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
            <div
              className={`${barColor} h-3 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {usagePercent.toFixed(1)}% do limite mensal
            </span>
            <span className={`font-medium ${usageColor}`}>
              {tokenService.formatTokenCount(summary.quota_remaining)} restantes
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              Total usado
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {tokenService.formatTokenCount(summary.total_tokens_used)}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
              <Clock className="w-4 h-4" />
              Reinicia em
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {daysUntilReset} {daysUntilReset === 1 ? 'dia' : 'dias'}
            </p>
          </div>
        </div>

        {Object.keys(summary.usage_by_operation).length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Uso por operação
            </h4>
            <div className="space-y-2">
              {Object.entries(summary.usage_by_operation).map(([operation, data]) => (
                <div
                  key={operation}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {operation.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      {data.count}x
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {tokenService.formatTokenCount(data.tokens)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentProcesses.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Processos recentes
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Últimos 5
              </span>
            </div>
            <div className="space-y-2">
              {recentProcesses.map((process) => (
                <div
                  key={process.id}
                  className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {process.file_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(process.created_at).toLocaleDateString('pt-BR')} • {process.pages_processed_successfully} pág
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400" title={`${process.tokens_consumed.toLocaleString('pt-BR')} tokens`}>
                      {tokenService.formatTokenCount(process.tokens_consumed)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {usagePercent >= 90 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              Você está próximo do seu limite mensal de tokens. Considere aguardar a renovação ou
              entrar em contato com o suporte para aumentar sua cota.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
