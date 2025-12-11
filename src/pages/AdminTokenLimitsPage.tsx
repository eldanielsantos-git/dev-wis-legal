import { useState, useEffect } from 'react';
import { Settings, RefreshCw, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import { TokenLimitCard } from '../components/TokenLimitCard';
import { TokenLimitEditModal } from '../components/TokenLimitEditModal';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function AdminTokenLimitsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [configs, setConfigs] = useState<TokenLimitConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingConfig, setEditingConfig] = useState<TokenLimitConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setError('');
      const data = await TokenLimitsService.getAllTokenLimits();
      setConfigs(data);
    } catch (err) {
      setError('Erro ao carregar configurações de tokens');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    TokenLimitsService.clearCache();
    await loadConfigs();
    setRefreshing(false);
  };

  const handleSave = async (id: string, newValue: number) => {
    try {
      await TokenLimitsService.updateTokenLimit(id, newValue);
      await loadConfigs();
    } catch (err) {
      throw new Error('Erro ao salvar configuração');
    }
  };

  const analysisConfigs = configs.filter((c) =>
    TokenLimitsService.getContextCategory(c.context_key) === 'analysis'
  );

  const chatConfigs = configs.filter((c) =>
    TokenLimitsService.getContextCategory(c.context_key) === 'chat'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Settings className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Configuração de Limites de Tokens
              </h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Gerencie os limites de tokens de output da LLM para diferentes contextos do sistema
          </p>
        </div>

        {error && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              isDark
                ? 'bg-red-900/20 border border-red-800'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileText className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Análise de Documentos
              </h2>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Configurações de tokens para processamento e análise de documentos PDF
            </p>

            {analysisConfigs.length === 0 ? (
              <div
                className={`p-8 rounded-lg text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}
              >
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Nenhuma configuração de análise encontrada
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analysisConfigs.map((config) => (
                  <TokenLimitCard
                    key={config.id}
                    config={config}
                    onEdit={setEditingConfig}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className={`w-6 h-6 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Sistema de Chat
              </h2>
            </div>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Configurações de tokens para conversas e interações com processos
            </p>

            {chatConfigs.length === 0 ? (
              <div
                className={`p-8 rounded-lg text-center ${
                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                }`}
              >
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  Nenhuma configuração de chat encontrada
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {chatConfigs.map((config) => (
                  <TokenLimitCard
                    key={config.id}
                    config={config}
                    onEdit={setEditingConfig}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div
          className={`mt-8 p-6 rounded-lg ${
            isDark
              ? 'bg-blue-900/20 border border-blue-800'
              : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <h3 className={`font-semibold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
            Informações Importantes
          </h3>
          <ul className={`space-y-2 text-sm ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
            <li>• Limites de tokens controlam o tamanho máximo da resposta da LLM</li>
            <li>• Valores maiores permitem respostas mais completas, mas consomem mais créditos</li>
            <li>• Valores muito baixos podem resultar em respostas incompletas ou JSONs truncados</li>
            <li>• As mudanças são aplicadas imediatamente para novas requisições</li>
            <li>• Recomenda-se testar após alterações significativas</li>
          </ul>
        </div>
      </div>

      {editingConfig && (
        <TokenLimitEditModal
          config={editingConfig}
          onClose={() => setEditingConfig(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
