import React, { useState } from 'react';
import { ArrowLeft, Bot, MessageSquare } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { AdminSystemModelsPage } from './AdminSystemModelsPage';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AdminModelsManagementPageProps {
  onBack: () => void;
  onNavigateToApp?: () => void;
  onNavigateToMyProcess?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

type TabType = 'analysis' | 'chat';

export function AdminModelsManagementPage({
  onBack,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
}: AdminModelsManagementPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');

  const tabs = [
    { id: 'analysis' as TabType, label: 'Modelos de Análise', icon: Bot },
    { id: 'chat' as TabType, label: 'Modelos de Chat', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: colors.background }}>
      <SidebarWis
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToTerms={onNavigateToTerms}
        onNavigateToPrivacy={onNavigateToPrivacy}
        onNavigateToCookies={onNavigateToCookies}
      />

      <div className="flex-1 flex flex-col" style={{ marginLeft: isSidebarCollapsed ? '80px' : '256px' }}>
        <header
          className="h-16 border-b flex items-center px-6 sticky top-0 z-10"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors mr-4"
            style={{
              color: colors.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="text-xl font-semibold" style={{ color: colors.text }}>
            Gerenciamento de Modelos LLM
          </h1>

          <div className="ml-auto">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: colors.text }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div
          className="border-b px-6"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-3 font-medium text-sm rounded-t-lg transition-colors flex items-center gap-2"
                  style={{
                    color: isActive ? colors.primary : colors.textSecondary,
                    backgroundColor: isActive ? colors.background : 'transparent',
                    borderBottom: isActive ? `2px solid ${colors.primary}` : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = colors.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'analysis' && (
            <AdminSystemModelsPage
              onBack={onBack}
              onNavigateToApp={onNavigateToApp}
              onNavigateToMyProcess={onNavigateToMyProcess}
              onNavigateToChat={onNavigateToChat}
              onNavigateToWorkspace={onNavigateToWorkspace}
              onNavigateToAdmin={onNavigateToAdmin}
              onNavigateToProfile={onNavigateToProfile}
              onNavigateToTerms={onNavigateToTerms}
              onNavigateToPrivacy={onNavigateToPrivacy}
              onNavigateToCookies={onNavigateToCookies}
            />
          )}

          {activeTab === 'chat' && (
            <div className="p-6">
              <div
                className="rounded-lg p-8 text-center"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  border: '1px solid',
                }}
              >
                <MessageSquare className="w-12 h-12 mx-auto mb-4" style={{ color: colors.primary }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
                  Modelos de Chat
                </h3>
                <p style={{ color: colors.textSecondary }}>
                  Área de gerenciamento de modelos LLM para chat em construção.
                </p>
              </div>
            </div>
          )}
        </div>

        <FooterWis />
      </div>

      {isSearchOpen && (
        <IntelligentSearch
          onClose={() => setIsSearchOpen(false)}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToProfile={onNavigateToProfile}
        />
      )}
    </div>
  );
}
