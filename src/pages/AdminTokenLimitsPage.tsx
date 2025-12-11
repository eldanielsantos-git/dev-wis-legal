import { useState, useEffect } from 'react';
import { Settings, ArrowLeft, FileText, MessageSquare, AlertCircle } from 'lucide-react';
import { TokenLimitCard } from '../components/TokenLimitCard';
import { TokenLimitEditModal } from '../components/TokenLimitEditModal';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';

interface AdminTokenLimitsPageProps {
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

export function AdminTokenLimitsPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
}: AdminTokenLimitsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const [configs, setConfigs] = useState<TokenLimitConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingConfig, setEditingConfig] = useState<TokenLimitConfig | null>(null);

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
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: colors.background }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: colors.background }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
        onCollapsedChange={setIsSidebarCollapsed}
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </button>

          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <Settings className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.primary }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Configuração de Limites de Tokens
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                  Gerencie os limites de tokens de output da LLM para diferentes contextos do sistema
                </p>
              </div>
            </div>

            {error && (
              <div
                className="mb-6 p-4 rounded-lg flex items-center gap-3 border"
                style={{
                  backgroundColor: colors.cardBackground,
                  borderColor: colors.border,
                }}
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <p className="text-red-500">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5" style={{ color: colors.primary }} />
                  <h2 className="text-xl font-title font-semibold" style={{ color: colors.text }}>
                    Análise de Documentos
                  </h2>
                </div>

                {analysisConfigs.length === 0 ? (
                  <div
                    className="p-8 rounded-lg text-center"
                    style={{ backgroundColor: colors.cardBackground }}
                  >
                    <p style={{ color: colors.mutedText }}>
                      Nenhuma configuração de análise encontrada
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                  <MessageSquare className="w-5 h-5" style={{ color: colors.success }} />
                  <h2 className="text-xl font-title font-semibold" style={{ color: colors.text }}>
                    Sistema de Chat
                  </h2>
                </div>

                {chatConfigs.length === 0 ? (
                  <div
                    className="p-8 rounded-lg text-center"
                    style={{ backgroundColor: colors.cardBackground }}
                  >
                    <p style={{ color: colors.mutedText }}>
                      Nenhuma configuração de chat encontrada
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
              className="mt-6 p-4 rounded-lg border"
              style={{
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              }}
            >
              <h3 className="font-title font-semibold mb-3 text-sm" style={{ color: colors.primary }}>
                Informações Importantes
              </h3>
              <ul className="space-y-1.5 text-xs" style={{ color: colors.mutedText }}>
                <li>• Limites de tokens controlam o tamanho máximo da resposta da LLM</li>
                <li>• Valores maiores permitem respostas mais completas, mas consomem mais créditos</li>
                <li>• Valores muito baixos podem resultar em respostas incompletas ou JSONs truncados</li>
                <li>• As mudanças são aplicadas imediatamente para novas requisições</li>
                <li>• Recomenda-se testar após alterações significativas</li>
              </ul>
            </div>
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>

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
