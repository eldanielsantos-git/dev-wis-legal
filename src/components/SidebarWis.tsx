import React, { useEffect, useState } from 'react';
import { Search, Plus, FileText, Sun, Moon, Coins, Menu, X, Home, ChevronLeft, ChevronRight, MessageSquare, UserPlus, Users, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { useResponsiveSidebar } from '../hooks/useResponsiveSidebar';
import { UserAvatar } from './UserAvatar';
import { UserAvatarMenu } from './UserAvatarMenu';
import { NotificationBadge } from './NotificationBadge';
import { ChatTokenCounter } from './ChatTokenCounter';
import { InviteFriendModal } from './InviteFriendModal';

interface SidebarWisProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToTokens?: () => void;
  onNavigateToSubscription?: () => void;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  onSearchClick?: () => void;
  activePage?: 'home' | 'myProcesses' | 'chat' | 'workspace' | 'schedule' | 'notifications' | 'settings' | 'profile' | 'tokens' | 'subscription';
}

export function SidebarWis({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToSchedule, onNavigateToAdmin, onNavigateToProfile, onNavigateToSettings, onNavigateToNotifications, onNavigateToTokens, onNavigateToSubscription, onCollapsedChange, onSearchClick, activePage }: SidebarWisProps) {
  const { profile, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const colors = getThemeColors(theme);
  const { isCollapsed, toggleCollapsed } = useResponsiveSidebar();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  const handleToggleCollapse = () => {
    toggleCollapsed();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const hoverBg = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const activeBg = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  const getButtonStyle = (page?: string) => {
    const isActive = activePage === page;
    return {
      color: colors.textPrimary,
      backgroundColor: isActive ? activeBg : 'transparent'
    };
  };

  return (
    <>
      <header className={`lg:hidden fixed top-0 right-0 z-50 h-16 flex items-center justify-between px-4 transition-[left] duration-300 ease-in-out left-0`} style={{ backgroundColor: colors.bgPrimary, borderBottom: `1px solid ${colors.border}` }}>
        <button
          onClick={onNavigateToApp}
          className="hover:opacity-80 transition-opacity"
          title="Ir para página inicial"
        >
          <img
            src={colors.logo}
            alt="Wis Legal"
            className="h-8"
          />
        </button>

        <div className="flex items-center space-x-3">
          <ChatTokenCounter />

          <button
            onClick={onSearchClick}
            className="p-2 rounded-lg transition-colors"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Busca"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={onNavigateToProfile}
            className="hover:opacity-80 transition-opacity"
            title="Meu perfil"
          >
            <UserAvatar
              avatarUrl={profile?.avatar_url}
              firstName={profile?.first_name}
              lastName={profile?.last_name}
              size="sm"
            />
          </button>

          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: colors.textPrimary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`lg:hidden fixed top-16 right-0 bottom-0 w-64 z-40 flex flex-col font-body transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ backgroundColor: colors.bgPrimary, borderLeft: `1px solid ${colors.border}` }}>
        <nav className="flex-1 px-3 py-4 space-y-1 flex flex-col overflow-y-auto">
          <div className="space-y-1">
            <button
              onClick={() => {
                onNavigateToApp();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('home')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'home' ? activeBg : 'transparent'}
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Início</span>
            </button>

            <button
              onClick={() => {
                console.log('[SidebarWis Mobile] Botão + clicado');
                onNavigateToApp();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Novo processo</span>
            </button>

            <button
              onClick={() => {
                onNavigateToMyProcess();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('myProcesses')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'myProcesses' ? activeBg : 'transparent'}
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Meus processos</span>
            </button>

            <button
              onClick={() => {
                onNavigateToChat?.();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('chat')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'chat' ? activeBg : 'transparent'}
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Chat</span>
            </button>

            <button
              onClick={() => {
                console.log('Workspace button clicked, onNavigateToWorkspace:', onNavigateToWorkspace);
                if (onNavigateToWorkspace) {
                  onNavigateToWorkspace();
                } else {
                  console.error('onNavigateToWorkspace is undefined!');
                }
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('workspace')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'workspace' ? activeBg : 'transparent'}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Meu workspace</span>
            </button>

            <button
              onClick={() => {
                onNavigateToSchedule?.();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('schedule')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'schedule' ? activeBg : 'transparent'}
            >
              <Calendar className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Agenda</span>
            </button>
          </div>

          <div className="flex-1"></div>

          <div className="space-y-1 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            <button
              onClick={() => {
                toggleTheme();
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
              <span className="ml-3 text-sm font-medium">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
            </button>

            <div onClick={() => {
              if (onNavigateToNotifications) {
                onNavigateToNotifications();
                closeMobileMenu();
              }
            }}>
              <NotificationBadge
                onClick={() => {}}
                isCollapsed={false}
                isActive={activePage === 'notifications'}
              />
            </div>

            <button
              onClick={() => {
                if (onNavigateToTokens) {
                  onNavigateToTokens();
                  closeMobileMenu();
                }
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={getButtonStyle('tokens')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'tokens' ? activeBg : 'transparent'}
            >
              <Coins className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Tokens</span>
            </button>

            <button
              onClick={() => {
                setIsInviteModalOpen(true);
                closeMobileMenu();
              }}
              className="w-full flex items-center px-4 py-3 rounded-lg transition-colors"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <UserPlus className="w-5 h-5 flex-shrink-0" />
              <span className="ml-3 text-sm font-medium">Enviar convite</span>
            </button>
          </div>
        </nav>
      </aside>

      <aside className={`hidden lg:flex ${isCollapsed ? 'w-20' : 'w-64'} h-screen fixed left-0 top-0 flex-col font-body transition-[width] duration-300 ease-in-out`} style={{ backgroundColor: colors.bgPrimary, borderRight: `1px solid ${colors.border}` }}>
        <div className="p-6 lg:max-h-[900px]:p-0.5 flex flex-col items-center justify-center flex-shrink-0">
          <button
            onClick={onNavigateToApp}
            className="hover:opacity-80 transition-opacity w-10 h-10 lg:max-h-[900px]:w-3.5 lg:max-h-[900px]:h-3.5 flex items-center justify-center"
            title="Ir para página inicial"
          >
            <img
              src={colors.logo}
              alt="Wis Legal"
              className="h-10 w-10 lg:max-h-[900px]:h-3.5 lg:max-h-[900px]:w-3.5 object-contain"
            />
          </button>
        </div>

        <nav className="flex-1 px-3 lg:max-h-[900px]:px-0.5 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div>
            <button
              onClick={handleToggleCollapse}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0 rounded-lg transition-colors mb-2 lg:max-h-[900px]:mb-0 ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title={isCollapsed ? "Expandir menu" : "Retrair menu"}
            >
              {isCollapsed ? <Menu className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3" /> : <ChevronLeft className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3" />}
            </button>

            <button
              onClick={() => onSearchClick?.()}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Busca"
            >
              <Search className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Busca</span>}
            </button>

            <button
              onClick={() => {
                console.log('[SidebarWis Desktop] Botão + clicado');
                onNavigateToApp();
              }}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('home')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'home' ? activeBg : 'transparent'}
              title="Novo processo"
            >
              <Plus className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Novo processo</span>}
            </button>

            <button
              onClick={onNavigateToMyProcess}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('myProcesses')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'myProcesses' ? activeBg : 'transparent'}
              title="Meus processos"
            >
              <FileText className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Meus processos</span>}
            </button>

            <button
              onClick={() => onNavigateToChat?.()}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('chat')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'chat' ? activeBg : 'transparent'}
              title="Chat"
            >
              <MessageSquare className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Chat</span>}
            </button>

            <button
              onClick={() => {
                console.log('Workspace button clicked (collapsed), onNavigateToWorkspace:', onNavigateToWorkspace);
                if (onNavigateToWorkspace) {
                  onNavigateToWorkspace();
                } else {
                  console.error('onNavigateToWorkspace is undefined!');
                }
              }}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('workspace')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'workspace' ? activeBg : 'transparent'}
              title="Meu workspace"
            >
              <Users className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Meu workspace</span>}
            </button>

            <button
              onClick={() => onNavigateToSchedule?.()}
              className={`w-full flex items-center py-3 lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('schedule')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'schedule' ? activeBg : 'transparent'}
              title="Agenda"
            >
              <Calendar className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Agenda</span>}
            </button>
          </div>

          <div className="flex-1"></div>

          <div className={`${isCollapsed ? '' : 'pt-4 lg:max-h-[900px]:pt-0.5'}`} style={!isCollapsed ? { borderTop: `1px solid ${colors.border}` } : {}}>
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center py-[18px] lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" /> : <Moon className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />}
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>}
            </button>

            <NotificationBadge
              onClick={() => onNavigateToNotifications?.()}
              isCollapsed={isCollapsed}
              isActive={activePage === 'notifications'}
            />

            <button
              onClick={() => onNavigateToTokens?.()}
              className={`w-full flex items-center py-[18px] lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={getButtonStyle('tokens')}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = activePage === 'tokens' ? activeBg : 'transparent'}
              title="Tokens"
            >
              <Coins className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Tokens</span>}
            </button>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className={`w-full flex items-center py-[18px] lg:max-h-[900px]:py-0.5 rounded-lg transition-colors ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5'}`}
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Enviar convite"
            >
              <UserPlus className="w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 flex-shrink-0" />
              {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 text-sm lg:max-h-[900px]:text-[9px] font-medium">Enviar convite</span>}
            </button>

          </div>
        </nav>

        <div className="p-3 lg:max-h-[768px]:p-0.5 flex-shrink-0" style={!isCollapsed ? { borderTop: `1px solid ${colors.border}` } : {}}>
          {isCollapsed ? (
            <div className="flex items-center py-3 lg:max-h-[768px]:py-0 justify-center">
              <UserAvatarMenu
                avatarUrl={profile?.avatar_url}
                firstName={profile?.first_name}
                lastName={profile?.last_name}
                size="md"
                showLabel={false}
                onEditProfile={() => {
                  window.location.hash = '#profile';
                  onNavigateToProfile?.();
                }}
                onViewSubscription={() => {
                  window.location.hash = '#subscription';
                  onNavigateToSubscription?.();
                }}
              />
            </div>
          ) : (
            <div className="flex items-center py-3 lg:max-h-[768px]:py-0 px-4 lg:max-h-[768px]:px-1">
              <UserAvatarMenu
                avatarUrl={profile?.avatar_url}
                firstName={profile?.first_name}
                lastName={profile?.last_name}
                size="md"
                showLabel={true}
                onEditProfile={() => {
                  window.location.hash = '#profile';
                  onNavigateToProfile?.();
                }}
                onViewSubscription={() => {
                  window.location.hash = '#subscription';
                  onNavigateToSubscription?.();
                }}
                className="flex-1"
              />
            </div>
          )}
        </div>
      </aside>

      <InviteFriendModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInviteSent={() => {
          console.log('Convite enviado com sucesso!');
        }}
      />
    </>
  );
}
