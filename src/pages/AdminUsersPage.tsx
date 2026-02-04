import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { UserAvatar } from '../components/UserAvatar';
import { Users, Search, Loader, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { playErrorSound } from '../utils/notificationSound';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface UserProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_country_code: string | null;
  oab: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  type: 'PF' | 'PJ' | null;
  created_at: string;
}

interface AdminUsersPageProps {
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

export function AdminUsersPage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToSchedule, onNavigateToAdmin, onNavigateToSettings, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminUsersPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'PF' | 'PJ'>('all');
  const USERS_PER_PAGE = 20;

  useEffect(() => {
    loadUsers();

    const handleFocus = () => {
      loadUsers();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore || searchTerm) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      if (scrollTop + clientHeight >= scrollHeight - 200) {
        loadMoreUsers();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, searchTerm, currentPage, filteredUsers]);

  useEffect(() => {
    let filtered = allUsers;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(user => user.type === typeFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return fullName.includes(term) || email.includes(term);
      });
      setFilteredUsers(filtered);
      setDisplayedUsers(filtered);
      setHasMore(false);
    } else {
      setFilteredUsers(filtered);
      const initialBatch = filtered.slice(0, USERS_PER_PAGE);
      setDisplayedUsers(initialBatch);
      setCurrentPage(0);
      setHasMore(filtered.length > USERS_PER_PAGE);
    }
  }, [searchTerm, allUsers, typeFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const sortedUsers = (profilesData || []).sort((a, b) => {
        const fullNameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
        const fullNameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();

        const displayNameA = (fullNameA || a.email || '').toLowerCase();
        const displayNameB = (fullNameB || b.email || '').toLowerCase();

        return displayNameA.localeCompare(displayNameB, 'pt-BR');
      });

      setAllUsers(sortedUsers);
      setFilteredUsers(sortedUsers);
      const initialBatch = sortedUsers.slice(0, USERS_PER_PAGE);
      setDisplayedUsers(initialBatch);
      setCurrentPage(0);
      setHasMore(sortedUsers.length > USERS_PER_PAGE);
    } catch (error: any) {
      playErrorSound();
    } finally {
      setLoading(false);
    }
  };

  const loadMoreUsers = () => {
    if (loadingMore || !hasMore || searchTerm) return;

    setLoadingMore(true);
    setTimeout(() => {
      const nextPage = currentPage + 1;
      const startIndex = nextPage * USERS_PER_PAGE;
      const endIndex = startIndex + USERS_PER_PAGE;
      const nextBatch = filteredUsers.slice(startIndex, endIndex);

      if (nextBatch.length > 0) {
        setDisplayedUsers(prev => [...prev, ...nextBatch]);
        setCurrentPage(nextPage);
        setHasMore(endIndex < filteredUsers.length);
      } else {
        setHasMore(false);
      }

      setLoadingMore(false);
    }, 300);
  };

  const handleUserClick = (user: UserProfile) => {
    window.history.pushState({}, '', `/admin-user/${user.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
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
            onClick={() => {
              window.history.pushState({}, '', '/profile#admin');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
          </button>

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <Users className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Gestão de Usuários
                </h1>
                <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                  Gerencie usuários e permissões do sistema
                </p>
              </div>
            </div>

            <div className="mb-4 sm:mb-6 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTypeFilter('all')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: typeFilter === 'all' ? '#3B82F6' : colors.bgSecondary,
                    color: typeFilter === 'all' ? '#FFFFFF' : colors.textPrimary,
                    border: typeFilter === 'all' ? 'none' : `1px solid ${theme === 'dark' ? '#4B5563' : '#D1D5DB'}`
                  }}
                >
                  Todos
                </button>
                <button
                  onClick={() => setTypeFilter('PF')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: typeFilter === 'PF' ? '#3B82F6' : colors.bgSecondary,
                    color: typeFilter === 'PF' ? '#FFFFFF' : colors.textPrimary,
                    border: typeFilter === 'PF' ? 'none' : `1px solid ${theme === 'dark' ? '#4B5563' : '#D1D5DB'}`
                  }}
                >
                  Pessoa Física
                </button>
                <button
                  onClick={() => setTypeFilter('PJ')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: typeFilter === 'PJ' ? '#3B82F6' : colors.bgSecondary,
                    color: typeFilter === 'PJ' ? '#FFFFFF' : colors.textPrimary,
                    border: typeFilter === 'PJ' ? 'none' : `1px solid ${theme === 'dark' ? '#4B5563' : '#D1D5DB'}`
                  }}
                >
                  Pessoa Jurídica
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary, borderColor: theme === 'dark' ? '#4B5563' : '#D1D5DB' }}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 animate-spin" style={{ color: '#3B82F6' }} />
              </div>
            ) : (
              <>
                {!loading && filteredUsers.length > 0 && (
                  <p className="text-xs sm:text-sm mb-3 sm:mb-4" style={{ color: colors.textSecondary }}>
                    {searchTerm ? (
                      <>Mostrando {displayedUsers.length} de {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}</>
                    ) : (
                      <>Mostrando {displayedUsers.length} de {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}</>
                    )}
                  </p>
                )}
                <div className="space-y-2 sm:space-y-3">
                  {displayedUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className="w-full rounded-lg p-3 sm:p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] text-left"
                      style={{ backgroundColor: colors.bgSecondary }}
                    >
                      <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                        <UserAvatar
                          avatarUrl={user.avatar_url}
                          firstName={user.first_name}
                          lastName={user.last_name}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start flex-wrap gap-1 sm:gap-2 mb-1">
                            <p className="text-sm sm:text-base font-semibold break-words" style={{ color: colors.textPrimary }}>
                              {user.first_name?.trim() && user.last_name?.trim()
                                ? `${user.first_name.trim()} ${user.last_name.trim()}`
                                : user.email || 'Nome não definido'}
                            </p>
                            {user.is_admin && (
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: colors.successIcon }} />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm break-words" style={{ color: colors.textSecondary }}>
                            {user.email || 'Email não disponível'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2 sm:hidden">
                            <span className="text-xs px-2 py-0.5 rounded whitespace-nowrap" style={{
                              backgroundColor: user.is_admin ? colors.successAccent : '#3B82F620',
                              color: user.is_admin ? colors.successIcon : '#3B82F6'
                            }}>
                              {user.is_admin ? 'Admin' : 'Usuário'}
                            </span>
                            <p className="text-xs" style={{ color: colors.textSecondary }}>
                              {formatDate(user.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center space-x-3 flex-shrink-0">
                          <span className="text-xs px-3 py-1 rounded whitespace-nowrap" style={{
                            backgroundColor: user.is_admin ? colors.successAccent : '#3B82F620',
                            color: user.is_admin ? colors.successIcon : '#3B82F6'
                          }}>
                            {user.is_admin ? 'Administrador' : 'Usuário'}
                          </span>
                          <p className="text-xs whitespace-nowrap" style={{ color: '#808080' }}>
                            {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {loadingMore && (
                  <div className="flex items-center justify-center py-6">
                    <Loader className="w-6 h-6 animate-spin" style={{ color: '#3B82F6' }} />
                    <span className="ml-2 text-sm" style={{ color: colors.textSecondary }}>
                      Carregando mais usuários...
                    </span>
                  </div>
                )}

                {!loadingMore && !hasMore && displayedUsers.length > 0 && !searchTerm && (
                  <div className="text-center py-6">
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Todos os usuários foram carregados
                    </p>
                  </div>
                )}
              </>
            )}

            {!loading && filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-lg" style={{ color: '#808080' }}>
                  Nenhum usuário encontrado
                </p>
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
