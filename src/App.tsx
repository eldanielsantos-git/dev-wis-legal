import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { logger } from './utils/logger';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { TokenBalanceProvider } from './contexts/TokenBalanceContext';

// Log module loading with timestamp to detect cache issues
const BUILD_TIMESTAMP = '2025-12-01T19:45:00Z';
logger.log('App.tsx', `🔥🔥🔥 MODULE LOADED - BUILD: ${BUILD_TIMESTAMP} 🔥🔥🔥`);
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { CookiesPage } from './pages/CookiesPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { AppHomePage } from './pages/AppHomePage';
import { MyProcessesPage } from './pages/MyProcessesPage';
import { ProcessoDetailPage } from './pages/ProcessoDetailPage';
import { MyProcessDetailPage } from './pages/MyProcessDetailPage';
import { AdminSystemModelsPage } from './pages/AdminSystemModelsPage';
import { AdminIntegrityPage } from './pages/AdminIntegrityPage';
import { AdminForensicPromptsPage } from './pages/AdminForensicPromptsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminUserDetailPage } from './pages/AdminUserDetailPage';
import { AdminUserProcessesPage } from './pages/AdminUserProcessesPage';
import { AdminTokenManagementPage } from './pages/AdminTokenManagementPage';
import { AdminQuotaManagementPage } from './pages/AdminQuotaManagementPage';
import { AdminStripeDiagnosticPage } from './pages/AdminStripeDiagnosticPage';
import { AdminTokenCreditsAuditPage } from './pages/AdminTokenCreditsAuditPage';
import { AdminSubscriptionManagementPage } from './pages/AdminSubscriptionManagementPage';
import { AdminTagsManagementPage } from './pages/AdminTagsManagementPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { TokensPage } from './pages/TokensPage';
import { ChatPage } from './pages/ChatPage';
import { ChatProcessSelectionPage } from './pages/ChatProcessSelectionPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { VerifyEmailRequiredPage } from './pages/VerifyEmailRequiredPage';
import { RequireEmailVerification } from './components/RequireEmailVerification';
import { Loader } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentPath === '/admin') {
      window.history.replaceState({}, '', '/admin-settings');
      setCurrentPath('/admin-settings');
    }
  }, [currentPath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0E0D' }}>
        <Loader className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (currentPath === '/terms') {
    return <TermsPage onBack={() => navigate(user ? '/app' : '/sign-in')} />;
  }

  if (currentPath === '/privacy') {
    return <PrivacyPage onBack={() => navigate(user ? '/app' : '/sign-in')} />;
  }

  if (currentPath === '/cookies') {
    return <CookiesPage onBack={() => navigate(user ? '/app' : '/sign-in')} />;
  }

  if (currentPath === '/reset-password') {
    return <ResetPasswordPage onNavigateToSignIn={() => navigate('/sign-in')} />;
  }

  if (currentPath === '/confirm-email') {
    return <ConfirmEmailPage />;
  }

  if (currentPath === '/verify-email-required') {
    return <VerifyEmailRequiredPage />;
  }

  if (!user) {
    logger.log('AppContent', 'No user, checking auth routes');
    if (currentPath === '/sign-up') {
      logger.log('AppContent', 'Rendering SignUpPage');
      return (
        <SignUpPage
          onNavigateToSignIn={() => navigate('/sign-in')}
          onNavigateToTerms={() => navigate('/terms')}
          onNavigateToPrivacy={() => navigate('/privacy')}
        />
      );
    }
    if (currentPath === '/forgot-password') {
      logger.log('AppContent', 'Rendering ForgotPasswordPage');
      return <ForgotPasswordPage onNavigateToSignIn={() => navigate('/sign-in')} />;
    }
    logger.log('AppContent', 'Rendering SignInPage (default for non-authenticated)');
    return (
      <SignInPage
        onNavigateToSignUp={() => navigate('/sign-up')}
        onNavigateToForgotPassword={() => navigate('/forgot-password')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  const pathMatch = currentPath.match(/^\/processo\/([a-f0-9-]+)$/);
  if (pathMatch) {
    return (
      <ProcessoDetailPage
        processoId={pathMatch[1]}
        onBack={() => navigate('/app')}
      />
    );
  }

  const detailPathMatch = currentPath.match(/^\/lawsuits-detail\/([a-f0-9-]+)$/);
  if (detailPathMatch) {
    return (
      <MyProcessDetailPage
        processoId={detailPathMatch[1]}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={(processoId) => navigate(processoId ? `/chat/${processoId}` : '/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/workspace') {
    return (
      <RequireEmailVerification
        onNavigateToSignIn={() => navigate('/sign-in')}
        onNavigateToVerifyEmail={() => navigate('/verify-email-required')}
      >
        <WorkspacePage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
        onNavigateToProcessDetail={(processoId) => navigate(`/lawsuits-detail/${processoId}`)}
      />
      </RequireEmailVerification>
    );
  }

  if (currentPath === '/chat') {
    return (
      <RequireEmailVerification
        onNavigateToSignIn={() => navigate('/sign-in')}
        onNavigateToVerifyEmail={() => navigate('/verify-email-required')}
      >
        <ChatProcessSelectionPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={(processoId) => navigate(processoId ? `/chat/${processoId}` : '/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToNotifications={() => navigate('/notifications')}
        onNavigateToTokens={() => navigate('/tokens')}
        onNavigateToSubscription={() => navigate('/signature')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
      </RequireEmailVerification>
    );
  }

  const chatPathMatch = currentPath.match(/^\/chat\/([a-f0-9-]+)$/);
  if (chatPathMatch) {
    return (
      <RequireEmailVerification
        onNavigateToSignIn={() => navigate('/sign-in')}
        onNavigateToVerifyEmail={() => navigate('/verify-email-required')}
      >
        <ChatPage
        processoId={chatPathMatch[1]}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToNotifications={() => navigate('/notifications')}
        onNavigateToTokens={() => navigate('/tokens')}
        onNavigateToSubscription={() => navigate('/signature')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
      </RequireEmailVerification>
    );
  }

  if (currentPath === '/profile') {
    return (
      <ProfilePage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToSettings={() => navigate('/admin')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
        onNavigateToSignIn={() => navigate('/sign-in')}
      />
    );
  }

  if (currentPath === '/admin-models') {
    return (
      <AdminSystemModelsPage
        onBack={() => navigate('/admin-settings')}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-tags') {
    return (
      <AdminTagsManagementPage
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-integrity') {
    return (
      <AdminIntegrityPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-prompts') {
    return (
      <AdminForensicPromptsPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-users') {
    return (
      <AdminUsersPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToSettings={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath.startsWith('/admin-user/')) {
    const pathParts = currentPath.split('/');
    const userId = pathParts[2];
    const subPath = pathParts[3];

    if (subPath === 'processes') {
      return (
        <AdminUserProcessesPage
          userId={userId}
          onNavigateBack={() => navigate(`/admin-user/${userId}`)}
          onNavigateToProcessDetail={(processoId) => navigate(`/lawsuits-detail/${processoId}`)}
          onNavigateToApp={() => navigate('/app')}
          onNavigateToMyProcess={() => navigate('/lawsuits')}
          onNavigateToChat={() => navigate('/chat')}
          onNavigateToWorkspace={() => navigate('/workspace')}
          onNavigateToAdmin={() => navigate('/admin-settings')}
          onNavigateToSettings={() => navigate('/admin-settings')}
          onNavigateToProfile={() => navigate('/profile')}
          onNavigateToTerms={() => navigate('/terms')}
          onNavigateToPrivacy={() => navigate('/privacy')}
          onNavigateToCookies={() => navigate('/cookies')}
        />
      );
    }

    return (
      <AdminUserDetailPage
        userId={userId}
        onNavigateBack={() => navigate('/admin-users')}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToSettings={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-tokens') {
    return (
      <AdminTokenManagementPage
        onNavigateToApp={() => navigate('/app')}
      />
    );
  }

  if (currentPath === '/admin-quota') {
    return (
      <AdminQuotaManagementPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-subscription-plans') {
    return (
      <AdminSubscriptionManagementPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-stripe-diagnostic') {
    return (
      <AdminStripeDiagnosticPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-token-credits-audit') {
    return (
      <AdminTokenCreditsAuditPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/admin-settings') {
    return (
      <AdminSettingsPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/lawsuits') {
    return (
      <MyProcessesPage
        onNavigateToDetail={(id) => navigate(`/lawsuits-detail/${id}`)}
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToApp={() => navigate('/app')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/notifications') {
    return (
      <NotificationsPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToSettings={() => navigate('/admin-settings')}
        onNavigateToNotifications={() => navigate('/notifications')}
        onNavigateToProcessDetail={(id) => navigate(`/lawsuits-detail/${id}`)}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/signature') {
    return (
      <SubscriptionPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

  if (currentPath === '/tokens') {
    return (
      <TokensPage
        onNavigateToApp={() => navigate('/app')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToAdmin={() => navigate('/admin-settings')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToSignature={() => navigate('/signature')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
      />
    );
  }

    logger.log('AppContent', 'No route matched, rendering AppHomePage with RequireEmailVerification');
    return (
      <RequireEmailVerification
        onNavigateToSignIn={() => navigate('/sign-in')}
        onNavigateToVerifyEmail={() => navigate('/verify-email-required')}
      >
        <AppHomePage
        onNavigateToDetail={(id) => navigate(`/lawsuits-detail/${id}`)}
        onNavigateToAdmin={() => navigate('/admin')}
        onNavigateToMyProcess={() => navigate('/lawsuits')}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToWorkspace={() => navigate('/workspace')}
        onNavigateToProfile={() => navigate('/profile')}
        onNavigateToTerms={() => navigate('/terms')}
        onNavigateToPrivacy={() => navigate('/privacy')}
        onNavigateToCookies={() => navigate('/cookies')}
        onNavigateToApp={() => navigate('/app')}
      />
      </RequireEmailVerification>
    );
}

logger.log('App.tsx', '🔥 Defining App function component');

function App() {
  logger.log('App', '🎯 FUNCTION App() CALLED - Starting render');

  // Test render - bypass all providers temporarily
  const isTestMode = window.location.search.includes('test=1');

  if (isTestMode) {
    logger.log('App', 'Test mode active');
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F0E0D',
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>✓ App OK</h1>
          <p>React está funcionando corretamente</p>
          <p style={{ color: '#888', marginTop: '20px' }}>Remova ?test=1 da URL para carregar o app normal</p>
        </div>
      </div>
    );
  }

  logger.log('App', 'Rendering with all providers');

  try {
    logger.log('App', 'About to render AuthProvider');
    return (
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <TokenBalanceProvider>
              <AppContent />
            </TokenBalanceProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    );
  } catch (error) {
    logger.error('App', 'Error rendering providers:', error);
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F0E0D',
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#ff4444', marginBottom: '20px' }}>Erro ao Carregar</h1>
          <pre style={{ fontSize: '12px', color: '#888' }}>{String(error)}</pre>
        </div>
      </div>
    );
  }
}

logger.log('App.tsx', '🔥 Exporting App as default');

export default App;

logger.log('App.tsx', '🔥 MODULE FULLY LOADED');
