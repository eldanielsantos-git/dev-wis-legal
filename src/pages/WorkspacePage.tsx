import React, { useState, useEffect } from 'react';
import { Users, Loader } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { WorkspaceService, WorkspaceShare } from '../services/WorkspaceService';
import { ProcessoCard } from '../components/ProcessoCard';
import type { Processo } from '../lib/supabase';
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
  const [sharedWithMe, setSharedWithMe] = useState<WorkspaceShare[]>([]);
  const [myShares, setMyShares] = useState<WorkspaceShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'received' | 'shared'>('received');
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
      const [received, shared] = await Promise.all([
        WorkspaceService.getSharedWithMe(),
        WorkspaceService.getMyShares()
      ]);
      setSharedWithMe(received);
      setMyShares(shared);
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
              Processos compartilhados
            </p>
          </section>

          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab('received')}
              className="px-6 py-2.5 rounded-lg font-medium transition-all duration-200"
              style={{
                backgroundColor: activeTab === 'received' ? colors.bgTertiary : 'transparent',
                color: activeTab === 'received' ? colors.textPrimary : colors.textSecondary,
                border: `1px solid ${colors.border}`
              }}
            >
              Compartilhados comigo
              {!loading && sharedWithMe.length > 0 && (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary
                  }}
                >
                  {sharedWithMe.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('shared')}
              className="px-6 py-2.5 rounded-lg font-medium transition-all duration-200"
              style={{
                backgroundColor: activeTab === 'shared' ? colors.bgTertiary : 'transparent',
                color: activeTab === 'shared' ? colors.textPrimary : colors.textSecondary,
                border: `1px solid ${colors.border}`
              }}
            >
              Compartilhados por mim
              {!loading && myShares.length > 0 && (
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary
                  }}
                >
                  {myShares.length}
                </span>
              )}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textPrimary }} />
            </div>
          ) : activeTab === 'received' && sharedWithMe.length === 0 ? (
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
                  Nenhum processo compartilhado com você ainda
                </h3>
                <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                  Quando alguém compartilhar um processo com você, ele aparecerá aqui.
                </p>
              </div>
            </div>
          ) : activeTab === 'shared' && myShares.length === 0 ? (
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
                  Você ainda não compartilhou nenhum processo
                </h3>
                <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
                  Acesse sua área de processos e análises e compartilhe processos com colegas de trabalho,
                  torne sua rotina de trabalho mais prática, ágil e com gestão inteligente.
                </p>
                <button
                  onClick={onNavigateToMyProcess}
                  className="px-6 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: theme === 'dark' ? '#FFFFFF' : '#000000',
                    color: theme === 'dark' ? '#000000' : '#FFFFFF'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#E5E5E5' : '#1A1A1A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#FFFFFF' : '#000000';
                  }}
                >
                  Meus Processos
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start">
              {(activeTab === 'received' ? sharedWithMe : myShares).map((share) => {
                if (!share.processo) return null;

                const processoData: Processo = {
                  id: share.processo_id,
                  user_id: share.owner_user_id,
                  file_name: share.processo.file_name || share.processo.nome_processo || 'Sem nome',
                  file_path: '',
                  file_url: '',
                  file_size: share.processo.file_size || 0,
                  transcricao: { totalPages: 0 },
                  status: share.processo.status as any,
                  created_at: share.processo.created_at,
                  updated_at: share.created_at,
                  is_complex: false
                };

                return (
                  <ProcessoCard
                    key={share.id}
                    processo={processoData}
                    onViewDetails={() => handleNavigateToDetail(share.processo_id)}
                    workspaceInfo={{
                      sharedWith: activeTab === 'shared' ? share.shared_with_name : undefined,
                      sharedBy: activeTab === 'received'
                        ? `${share.owner?.first_name || ''} ${share.owner?.last_name || ''}`.trim()
                        : undefined,
                      sharedAt: share.created_at,
                      permissionLevel: share.permission_level
                    }}
                  />
                );
              })}
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
        onSelectProcess={handleNavigateToDetail}
      />
    </div>
  );
}
