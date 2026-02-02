import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Loader, RefreshCw, ArrowLeft } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { IntegrityValidationService, IntegrityIssue } from '../services/IntegrityValidationService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AdminIntegrityPageProps {
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

export function AdminIntegrityPage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace,
  onNavigateToSchedule, onNavigateToAdmin, onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminIntegrityPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState<string | null>(null);
  const [healResults, setHealResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const result = await IntegrityValidationService.checkAllProcessosIntegrity();
      setIssues(result);
    } catch (error) {
      console.error('Erro ao carregar problemas de integridade:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHeal = async (processoId: string) => {
    setHealing(processoId);
    try {
      const result = await IntegrityValidationService.autoHealProcesso(processoId);
      setHealResults(prev => ({ ...prev, [processoId]: result }));
      if (result.success) {
        setTimeout(() => {
          loadIssues();
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao tentar recuperar processo:', error);
      setHealResults(prev => ({
        ...prev,
        [processoId]: { success: false, message: 'Erro inesperado durante recuperação' }
      }));
    } finally {
      setHealing(null);
    }
  };

  const getIssueTypeLabel = (type: string) => {
    switch (type) {
      case 'missing_consolidation':
        return 'Consolidação Pendente';
      case 'inconsistent_pages':
        return 'Inconsistência de Páginas';
      case 'missing_pages':
        return 'Páginas Faltando';
      default:
        return 'Problema Desconhecido';
    }
  };

  const getIssueTypeColor = (type: string) => {
    switch (type) {
      case 'missing_consolidation':
        return 'text-yellow-600 bg-yellow-100';
      case 'inconsistent_pages':
        return 'text-orange-600 bg-orange-100';
      case 'missing_pages':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
        <Loader className="w-8 h-8 animate-spin" style={{ color: '#F59E0B' }} />
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
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
        onCollapsedChange={setIsSidebarCollapsed}
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/profile#admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80"
              style={{
                backgroundColor: colors.bgSecondary,
                color: colors.textPrimary
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Voltar ao Painel</span>
            </button>

            <div className="mb-8">
              <div className="flex flex-col items-center mb-6">
                <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                  <AlertTriangle className="w-8 h-8" style={{ color: '#F59E0B' }} />
                </div>
                <div className="text-center">
                  <h1 className="text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                    Integridade de Dados
                  </h1>
                  <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                    Monitoramento e recuperação de processos com problemas
                  </p>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={loadIssues}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>
            {issues.length === 0 ? (
              <div className="rounded-xl shadow-lg p-8 text-center" style={{ backgroundColor: colors.bgSecondary }}>
                <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: colors.successIcon }} />
                <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
                  Tudo em Ordem!
                </h3>
                <p style={{ color: colors.textSecondary }}>
                  Nenhum problema de integridade foi detectado nos processos.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl p-4 flex items-start space-x-3" style={{ backgroundColor: colors.bgSecondary, borderLeft: '4px solid #F59E0B' }}>
                  <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                  <div>
                    <h3 className="text-lg font-semibold mb-1" style={{ color: colors.textPrimary }}>
                      {issues.length} {issues.length === 1 ? 'Problema Detectado' : 'Problemas Detectados'}
                    </h3>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Processos que precisam de atenção ou recuperação manual
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {issues.map((issue) => (
                    <div
                      key={issue.processoId}
                      className="rounded-xl shadow-lg p-6"
                      style={{ backgroundColor: colors.bgSecondary }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <span
                              className="px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor: colors.bgPrimary,
                                color: issue.issueType === 'missing_consolidation' ? '#F59E0B' :
                                  issue.issueType === 'inconsistent_pages' ? '#FB923C' : '#EF4444'
                              }}
                            >
                              {getIssueTypeLabel(issue.issueType)}
                            </span>
                            <span className="text-xs" style={{ color: colors.textSecondary }}>Status: {issue.status}</span>
                          </div>
                          <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                            {issue.fileName}
                          </h3>
                          <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>{issue.description}</p>
                          <div className="flex items-center space-x-4 text-xs" style={{ color: colors.textSecondary }}>
                            <span>ID: {issue.processoId.substring(0, 8)}...</span>
                            <span>Páginas na tabela: {issue.paginasCount}</span>
                            <span>Páginas consolidadas: {issue.processContentCount}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          {issue.issueType === 'missing_consolidation' && (
                            <button
                              onClick={() => handleHeal(issue.processoId)}
                              disabled={healing === issue.processoId}
                              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: colors.successIcon, color: '#FFFFFF' }}
                            >
                              {healing === issue.processoId ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" />
                                  <span>Recuperando...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  <span>Recuperar</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {healResults[issue.processoId] && (
                        <div
                          className="mt-4 p-3 rounded-lg"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            borderLeft: healResults[issue.processoId].success ? `4px solid ${colors.successBorder}` : '4px solid #EF4444'
                          }}
                        >
                          <p
                            className="text-sm"
                            style={{ color: colors.textPrimary }}
                          >
                            {healResults[issue.processoId].message}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>
      {isSearchOpen && (
        <IntelligentSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </div>
  );
}
