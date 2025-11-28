import React, { useState, useEffect } from 'react';
import { Users, Loader, Lock, Edit3, Calendar, FileText } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { WorkspaceService, WorkspaceShare } from '../services/WorkspaceService';
import { ProcessStatusBadge } from '../components/ProcessStatusBadge';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface WorkspacePageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
  onNavigateToProcessDetail?: (processoId: string) => void;
}

export function WorkspacePage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
  onNavigateToProcessDetail
}: WorkspacePageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadShares();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    WorkspaceService.subscribeToShares(() => {
      loadShares();
    }).then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadShares = async () => {
    try {
      const data = await WorkspaceService.getSharedWithMe();
      setShares(data);
    } catch (error) {
      console.error('Error loading shared processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToDetail = (processoId: string) => {
    if (onNavigateToProcessDetail) {
      onNavigateToProcessDetail(processoId);
    } else {
      window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToSettings={onNavigateToAdmin}
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
        onSearchClick={() => setIsSearchOpen(true)}
        activePage="workspace"
      />

      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <section className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center mb-4 gap-3">
              <Users className="w-8 h-8" style={{ color: colors.textPrimary }} />
              <h1 className="text-3xl sm:text-4xl font-title font-bold" style={{ color: colors.textPrimary }}>
                Workspace Wis
              </h1>
            </div>
            <p className="text-sm sm:text-base font-body text-center" style={{ color: colors.textSecondary }}>
              Processos compartilhados com você
            </p>
            {!loading && shares.length > 0 && (
              <p className="text-sm sm:text-base font-body mt-2 text-center" style={{ color: colors.textTertiary }}>
                Você tem {shares.length} {shares.length === 1 ? 'processo compartilhado' : 'processos compartilhados'}
              </p>
            )}
          </section>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textPrimary }} />
            </div>
          ) : shares.length === 0 ? (
            <div
              className="rounded-xl border p-12 text-center"
              style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
            >
              <div className="max-w-md mx-auto">
                <div
                  className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: colors.bgTertiary }}
                >
                  <Users className="w-7 h-7" style={{ color: colors.textSecondary }} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                  Você ainda não tem nenhum Processo com análise compartilhada
                </h3>
                <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                  Acesse sua área de processos e análises e compartilhe processos com colegas de trabalho,
                  torne sua rotina de trabalho mais prática, ágil e com gestão inteligente.
                </p>
                <button
                  onClick={onNavigateToMyProcess}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Meus Processos
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shares.map((share) => (
                <div
                  key={share.id}
                  onClick={() => handleNavigateToDetail(share.processo_id)}
                  className="rounded-xl border p-6 cursor-pointer hover:shadow-lg transition-all duration-200"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border
                  }}
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3
                        className="text-lg font-semibold line-clamp-2"
                        style={{ color: colors.textPrimary }}
                      >
                        {share.processo?.nome_processo || 'Sem nome'}
                      </h3>
                    </div>

                    {share.processo?.numero_processo && (
                      <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                        {share.processo.numero_processo}
                      </p>
                    )}

                    <div className="mb-3">
                      {share.processo && (
                        <ProcessStatusBadge status={share.processo.status} />
                      )}
                    </div>

                    <div
                      className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: share.permission_level === 'read_only' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: share.permission_level === 'read_only' ? '#f59e0b' : '#3b82f6'
                      }}
                    >
                      {share.permission_level === 'read_only' ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Somente Leitura</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3 h-3" />
                          <span>Editor</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="pt-4 border-t space-y-2"
                    style={{ borderColor: colors.border }}
                  >
                    <div className="flex items-center text-xs" style={{ color: colors.textSecondary }}>
                      <Users className="w-4 h-4 mr-2" />
                      <span>
                        Compartilhado por {share.owner?.first_name} {share.owner?.last_name}
                      </span>
                    </div>

                    <div className="flex items-center text-xs" style={{ color: colors.textSecondary }}>
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Compartilhado em {formatDate(share.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>

      <IntelligentSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigateToDetail={handleNavigateToDetail}
      />
    </div>
  );
}
