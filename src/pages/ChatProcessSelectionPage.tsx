import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { ProcessoCard } from '../components/ProcessoCard';
import { ProcessosService } from '../services/ProcessosService';
import { WorkspaceService } from '../services/WorkspaceService';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Loader } from 'lucide-react';
import type { Processo } from '../lib/supabase';

interface ChatProcessSelectionPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat: (processoId?: string) => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function ChatProcessSelectionPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat, onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: ChatProcessSelectionPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { user, isAdmin } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [sharedProcessIds, setSharedProcessIds] = useState<Set<string>>(new Set());
  const [shareCountByProcesso, setShareCountByProcesso] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadProcessos();
    loadSharedProcessIds();
  }, [user]);

  const loadProcessos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const allProcessos = await ProcessosService.getAllProcessos();
      const completedProcessos = allProcessos.filter(p => p.status === 'completed');
      setProcessos(completedProcessos);
    } catch (err) {
      console.error('Erro ao carregar processos:', err);
      setError('Erro ao carregar processos');
    } finally {
      setLoading(false);
    }
  };

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

  const handleProcessoClick = (processo: Processo) => {
    onNavigateToChat(processo.id);
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={() => onNavigateToChat()}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
        onCollapsedChange={setIsSidebarCollapsed}
        activePage="chat"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <section className="mb-6 sm:mb-8">
            <div className="flex items-center justify-center mb-4 gap-3">
              <MessageSquare className="w-8 h-8" style={{ color: colors.textPrimary }} />
              <h1 className="text-3xl sm:text-4xl font-title font-bold" style={{ color: colors.textPrimary }}>Selecione um Processo</h1>
            </div>
            <p className="text-sm sm:text-base font-body text-center" style={{ color: colors.textSecondary }}>
              Escolha um processo para iniciar uma conversa com a IA
            </p>
          </section>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
            </div>
          ) : error ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <p className="text-red-500">{error}</p>
            </div>
          ) : processos.length === 0 ? (
            <div className="text-center py-12 rounded-lg" style={{ backgroundColor: colors.bgSecondary }}>
              <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.textSecondary }} />
              <p className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
                Nenhum processo disponível
              </p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Você precisa ter processos analisados para usar o chat
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {processos.map((processo) => (
                <ProcessoCard
                  key={processo.id}
                  processo={processo}
                  onViewDetails={handleProcessoClick}
                  isShared={sharedProcessIds.has(processo.id)}
                  shareCount={shareCountByProcesso.get(processo.id) || 0}
                />
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
    </div>
  );
}
