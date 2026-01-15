import React, { useState, useEffect, useCallback } from 'react';
import { ProcessoCard } from '../components/ProcessoCard';
import { ProcessoListItem } from '../components/ProcessoListItem';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { ProcessosService } from '../services/ProcessosService';
import { WorkspaceService } from '../services/WorkspaceService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { FileText, Loader, LayoutGrid, List, Users, Tag } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { supabase } from '../lib/supabase';
import type { Processo, ProcessoTag } from '../lib/supabase';
import { ProcessoTagsService } from '../services/ProcessoTagsService';
import { ProcessoTagAssignmentsService } from '../services/ProcessoTagAssignmentsService';
import { TagFilterPanel } from '../components/tags/TagFilterPanel';
import { ProcessoTagComponent } from '../components/tags/ProcessoTag';

interface MyProcessesPageProps {
  onNavigateToDetail: (processoId: string) => void;
  onNavigateToAdmin: () => void;
  onNavigateToApp: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
  onNavigateToSchedule?: () => void;
}

export function MyProcessesPage({ onNavigateToDetail: _onNavigateToDetail, onNavigateToAdmin, onNavigateToApp, onNavigateToChat, onNavigateToWorkspace, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies, onNavigateToSchedule }: MyProcessesPageProps) {
  const onNavigateToDetail = (processoId: string) => {
    window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const { isAdmin, user } = useAuth();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [processoToDelete, setProcessoToDelete] = useState<Processo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterMode, setFilterMode] = useState<'all' | 'shared' | 'tags'>('all');
  const [sharedProcessIds, setSharedProcessIds] = useState<Set<string>>(new Set());
  const [shareCountByProcesso, setShareCountByProcesso] = useState<Map<string, number>>(new Map());
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isTagFilterPanelOpen, setIsTagFilterPanelOpen] = useState(false);
  const [availableTags, setAvailableTags] = useState<ProcessoTag[]>([]);
  const [tagCounts, setTagCounts] = useState<Map<string, number>>(new Map());

  const loadProcessos = useCallback(async (isInitialLoad = false) => {
    try {
      setError(null);

      const allProcessos = await ProcessosService.getProcessos();

      // Load tags for each processo
      const processosWithTags = await Promise.all(
        allProcessos.map(async (processo) => {
          const tags = await ProcessoTagAssignmentsService.getTagsByProcessoId(processo.id);
          return { ...processo, tags };
        })
      );

      // Sort by created_at descending (most recent first)
      const sortedProcessos = processosWithTags.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setProcessos(sortedProcessos);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar processos');
    } finally {
      if (isInitialLoad) {
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadProcessos(true);
    loadSharedProcessIds();
    loadAvailableTags();
  }, [loadProcessos]);

  const loadSharedProcessIds = async () => {
    try {
      const shares = await WorkspaceService.getMyShares();
      const ids = new Set(shares.map(share => share.processo_id));
      setSharedProcessIds(ids);

      // Count shares per processo
      const countMap = new Map<string, number>();
      shares.forEach(share => {
        const currentCount = countMap.get(share.processo_id) || 0;
        countMap.set(share.processo_id, currentCount + 1);
      });
      setShareCountByProcesso(countMap);
    } catch (error) {
      console.error('Error loading shared process IDs:', error);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const tags = await ProcessoTagsService.getAllTags();
      setAvailableTags(tags);

      const counts = new Map<string, number>();
      for (const tag of tags) {
        const count = await ProcessoTagAssignmentsService.getProcessosCountByTag(tag.id);
        counts.set(tag.id, count);
      }
      setTagCounts(counts);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  useEffect(() => {
    const pollingInterval = setInterval(() => {
      setProcessos(currentProcessos => {
        const hasProcessingProcessos = currentProcessos.some(p =>
          p.status === 'analyzing' || p.status === 'created' || p.status === 'uploading'
        );

        if (hasProcessingProcessos) {
          console.log('[MyProcessesPage] Polling: atualizando processos em andamento');
          loadProcessos();
        }

        return currentProcessos;
      });
    }, 2000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [loadProcessos]);

  useEffect(() => {
    const channelName = `processo-status-changes-${user?.id || 'anonymous'}`;

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processos',
          filter: user ? `user_id=eq.${user.id}` : undefined,
        },
        (payload) => {
          console.log('[MyProcessesPage] Processo atualizado via realtime:', payload);
          loadProcessos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, loadProcessos]);

  const handleViewDetails = (processo: Processo) => {
    onNavigateToDetail(processo.id);
  };

  const handleDeleteProcesso = (processo: Processo) => {
    setProcessoToDelete(processo);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProcesso = async () => {
    if (!processoToDelete) return;

    try {
      setError(null);
      const result = await ProcessosService.deleteProcesso(processoToDelete.id);
      if (result.success) {
        setProcessos(prev => prev.filter(p => p.id !== processoToDelete.id));
        setDeleteModalOpen(false);
        setProcessoToDelete(null);
      } else {
        setError(result.error || 'Erro ao excluir processo');
        setDeleteModalOpen(false);
        setProcessoToDelete(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir processo');
      setDeleteModalOpen(false);
      setProcessoToDelete(null);
    }
  };

  const cancelDeleteProcesso = () => {
    setDeleteModalOpen(false);
    setProcessoToDelete(null);
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={() => {}}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
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
        activePage="myProcesses"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <section className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center mb-4 gap-4">
              <h1 className="text-3xl sm:text-4xl font-title font-bold" style={{ color: colors.textPrimary }}>Meus Processos</h1>
              {!initialLoading && processos.length > 0 && (
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="hidden sm:flex p-2 rounded-lg transition-all duration-200 hover:scale-110"
                  style={{ backgroundColor: colors.bgSecondary }}
                  title={viewMode === 'grid' ? 'Visualização em lista' : 'Visualização em cards'}
                >
                  {viewMode === 'grid' ? (
                    <List className="w-5 h-5" style={{ color: colors.textPrimary }} />
                  ) : (
                    <LayoutGrid className="w-5 h-5" style={{ color: colors.textPrimary }} />
                  )}
                </button>
              )}
            </div>
            <p className="text-sm sm:text-base font-body text-center" style={{ color: colors.textSecondary }}>Visualize e gerencie todos os seus processos</p>

            {!initialLoading && processos.length > 0 && (
              <>
                <div className="flex justify-center mt-6 mb-4">
                  <div className="inline-flex rounded-lg p-0.5 sm:p-1" style={{ backgroundColor: colors.bgSecondary }}>
                    <button
                      onClick={() => {
                        setFilterMode('all');
                        setSelectedTagIds([]);
                      }}
                      className="px-2.5 sm:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
                      style={{
                        backgroundColor: filterMode === 'all' ? colors.bgPrimary : 'transparent',
                        color: filterMode === 'all' ? colors.textPrimary : colors.textSecondary
                      }}
                    >
                      Todos
                      <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: colors.bgTertiary }}>
                        {processos.length}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setFilterMode('shared');
                        setSelectedTagIds([]);
                      }}
                      className="px-2.5 sm:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center space-x-1 sm:space-x-2"
                      style={{
                        backgroundColor: filterMode === 'shared' ? colors.bgPrimary : 'transparent',
                        color: filterMode === 'shared' ? colors.textPrimary : colors.textSecondary
                      }}
                    >
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Compartilhados</span>
                      <span className="sm:hidden">Compart.</span>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: colors.bgTertiary }}>
                        {sharedProcessIds.size}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setFilterMode('tags');
                        setIsTagFilterPanelOpen(true);
                      }}
                      className="px-2.5 sm:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center space-x-1 sm:space-x-2"
                      style={{
                        backgroundColor: filterMode === 'tags' ? colors.bgPrimary : 'transparent',
                        color: filterMode === 'tags' ? colors.textPrimary : colors.textSecondary
                      }}
                    >
                      <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Tags</span>
                      {selectedTagIds.length > 0 && (
                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: colors.accent }}>
                          {selectedTagIds.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                {filterMode === 'tags' && selectedTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {selectedTagIds.map(tagId => {
                      const tag = availableTags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <ProcessoTagComponent
                          key={tag.id}
                          tag={tag}
                          size="sm"
                          removable
                          onRemove={() => {
                            setSelectedTagIds(prev => prev.filter(id => id !== tagId));
                          }}
                        />
                      );
                    })}
                    <button
                      onClick={() => setSelectedTagIds([])}
                      className="text-xs px-3 py-1 rounded-full hover:opacity-80"
                      style={{ backgroundColor: colors.bgSecondary, color: colors.textSecondary }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
                <p className="text-sm sm:text-base font-body mt-2 text-center" style={{ color: colors.textTertiary }}>
                  {filterMode === 'all'
                    ? `Você tem ${processos.length} ${processos.length === 1 ? 'processo' : 'processos'}`
                    : filterMode === 'shared'
                    ? `Você compartilhou ${sharedProcessIds.size} ${sharedProcessIds.size === 1 ? 'processo' : 'processos'}`
                    : `Filtrando por ${selectedTagIds.length} ${selectedTagIds.length === 1 ? 'tag' : 'tags'}`
                  }
                </p>
              </>
            )}
          </section>

          {error && (
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {initialLoading ? (
            <div className="flex justify-center py-16">
              <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textPrimary }} />
            </div>
          ) : processos.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
              <div className="max-w-sm mx-auto">
                <div className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: colors.bgTertiary }}>
                  <FileText className="w-7 h-7" style={{ color: colors.textSecondary }} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Você ainda não tem nenhum processo em análise</h3>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Faça upload do seu primeiro processo e descubra uma forma mais ágil e inteligente de trabalhar
                </p>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                let filteredProcessos = processos;

                if (filterMode === 'shared') {
                  filteredProcessos = processos.filter(p => sharedProcessIds.has(p.id));
                } else if (filterMode === 'tags' && selectedTagIds.length > 0) {
                  filteredProcessos = processos.filter(processo => {
                    if (!processo.tags || processo.tags.length === 0) return false;
                    return selectedTagIds.some(tagId =>
                      processo.tags!.some(tag => tag.id === tagId)
                    );
                  });
                }

                if (filteredProcessos.length === 0 && filterMode === 'shared') {
                  return (
                    <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                      <div className="max-w-sm mx-auto">
                        <div className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: colors.bgTertiary }}>
                          <Users className="w-7 h-7" style={{ color: colors.textSecondary }} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>Você ainda não compartilhou nenhum processo</h3>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          Compartilhe seus processos analisados com colegas para colaborar de forma mais eficiente
                        </p>
                      </div>
                    </div>
                  );
                }

                if (filteredProcessos.length === 0 && filterMode === 'tags') {
                  return (
                    <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
                      <div className="max-w-sm mx-auto">
                        <div className="p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: colors.bgTertiary }}>
                          <Tag className="w-7 h-7" style={{ color: colors.textSecondary }} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                          Nenhum processo encontrado com {selectedTagIds.length === 1 ? 'esta tag' : 'estas tags'}
                        </h3>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          Tente selecionar outras tags ou adicione tags aos seus processos
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-wrap justify-center gap-6 sm:contents">
                    <div className={`hidden sm:${viewMode === 'grid' ? 'flex flex-wrap justify-center gap-6' : 'block space-y-4'}`}>
                      {filteredProcessos.map(processo => {
                    const isOwner = user?.id === processo.user_id;
                    const canDelete = isAdmin || isOwner;
                    const commonProps = {
                      key: processo.id,
                      processo,
                      onViewDetails: handleViewDetails,
                      onDelete: canDelete ? handleDeleteProcesso : undefined,
                      isAdmin,
                      isShared: sharedProcessIds.has(processo.id),
                      shareCount: shareCountByProcesso.get(processo.id) || 0,
                      userInfo: processo.user_profile ? {
                        name: `${processo.user_profile.first_name} ${processo.user_profile.last_name}`.trim(),
                        email: processo.user_profile.email,
                        created_at: processo.user_profile.created_at
                      } : undefined
                    };

                    return viewMode === 'grid' ? (
                      <ProcessoCard {...commonProps} />
                    ) : (
                      <ProcessoListItem {...commonProps} />
                    );
                  })}
                </div>
                    <div className="sm:hidden w-full flex flex-wrap justify-center gap-6">
                      {filteredProcessos.map(processo => {
                        const isOwner = user?.id === processo.user_id;
                        const canDelete = isAdmin || isOwner;
                        return (
                          <ProcessoCard
                            key={processo.id}
                            processo={processo}
                            onViewDetails={handleViewDetails}
                            onDelete={canDelete ? handleDeleteProcesso : undefined}
                            isAdmin={isAdmin}
                            isShared={sharedProcessIds.has(processo.id)}
                            shareCount={shareCountByProcesso.get(processo.id) || 0}
                            userInfo={processo.user_profile ? {
                              name: `${processo.user_profile.first_name} ${processo.user_profile.last_name}`.trim(),
                              email: processo.user_profile.email,
                              created_at: processo.user_profile.created_at
                            } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {processos.length > 0 && (
                <div className="flex justify-center py-8">
                  <p className="text-sm" style={{ color: colors.textSecondary }}>Todos os processos foram carregados</p>
                </div>
              )}
            </>
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
        onSelectProcess={onNavigateToDetail}
      />
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        fileName={processoToDelete?.file_name || ''}
        onConfirm={confirmDeleteProcesso}
        onCancel={cancelDeleteProcesso}
      />
      <TagFilterPanel
        isOpen={isTagFilterPanelOpen}
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        onTagsChange={setSelectedTagIds}
        onClose={() => setIsTagFilterPanelOpen(false)}
        tagCounts={tagCounts}
      />
    </div>
  );
}
