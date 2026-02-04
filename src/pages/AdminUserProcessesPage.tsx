import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { ProcessoCard } from '../components/ProcessoCard';
import { ArrowLeft, Loader, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Processo } from '../lib/supabase';
import { playErrorSound } from '../utils/notificationSound';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface UserProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface AdminUserProcessesPageProps {
  userId: string;
  onNavigateBack: () => void;
  onNavigateToProcessDetail: (processoId: string) => void;
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminUserProcessesPage({
  userId,
  onNavigateBack,
  onNavigateToProcessDetail,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminUserProcessesPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    loadUserAndProcessos();
  }, [userId]);

  const loadUserAndProcessos = async () => {
    try {
      setLoading(true);

      const [userResult, processosResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name, avatar_url')
          .eq('id', userId)
          .single(),
        supabase
          .from('processos')
          .select(`
            id,
            user_id,
            file_name,
            file_size,
            status,
            created_at,
            updated_at,
            analysis_started_at,
            analysis_completed_at,
            current_prompt_number,
            total_prompts,
            last_error_type,
            current_llm_model_id,
            current_llm_model_name,
            llm_model_switching,
            llm_switch_reason,
            tokens_consumed,
            transcricao
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (userResult.error) {
        throw userResult.error;
      }
      if (processosResult.error) {
        throw processosResult.error;
      }

      setUser(userResult.data);
      setProcessos(processosResult.data || []);
    } catch (error: any) {
      playErrorSound();
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    if (user.first_name?.trim() && user.last_name?.trim()) {
      return `${user.first_name.trim()} ${user.last_name.trim()}`;
    }
    return user.email || 'Usuário';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToSchedule={onNavigateToSchedule}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToSettings={onNavigateToSettings}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToNotifications={() => {}}
          onNavigateToTokens={() => {}}
          onNavigateToSubscription={() => {}}
          onCollapsedChange={setIsSidebarCollapsed}
          onSearchClick={() => setIsSearchOpen(true)}
        />
        <main className={`flex-1 flex items-center justify-center transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
          <Loader className="w-8 h-8 animate-spin" style={{ color: '#3B82F6' }} />
        </main>
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
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
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
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar para Detalhes do Usuário</span>
          </button>

          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <FileText className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Processos de {getUserDisplayName()}
                </h1>
                {loading ? (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Loader className="w-3 h-3 animate-spin" style={{ color: colors.textSecondary }} />
                    <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                      Carregando...
                    </p>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                    {processos.length} {processos.length === 1 ? 'processo encontrado' : 'processos encontrados'}
                  </p>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center">
                  <Loader className="w-12 h-12 animate-spin mb-4" style={{ color: '#3B82F6' }} />
                  <p className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
                    Carregando processos...
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Aguarde enquanto buscamos os processos do usuário
                  </p>
                </div>
              </div>
            ) : processos.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 rounded-full inline-block mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                  <FileText className="w-12 h-12" style={{ color: colors.textSecondary }} />
                </div>
                <p className="text-lg font-medium mb-2" style={{ color: colors.textPrimary }}>
                  Nenhum processo encontrado
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Este usuário ainda não possui processos cadastrados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 justify-items-center">
                {processos.map((processo) => (
                  <ProcessoCard
                    key={processo.id}
                    processo={processo}
                    onViewDetails={(p) => onNavigateToProcessDetail(p.id)}
                    isAdmin={true}
                    userInfo={{
                      name: getUserDisplayName(),
                      email: user?.email || '',
                      created_at: processo.created_at
                    }}
                  />
                ))}
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
