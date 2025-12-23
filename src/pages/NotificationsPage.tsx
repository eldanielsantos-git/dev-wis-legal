import React, { useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { Bell, CheckCircle, AlertCircle, Trash2, Check, Filter } from 'lucide-react';

interface NotificationsPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToProcessDetail?: (processoId: string) => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

type FilterType = 'all' | 'unread' | 'success' | 'error';

export function NotificationsPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToProfile,
  onNavigateToSettings,
  onNavigateToNotifications,
  onNavigateToProcessDetail,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: NotificationsPageProps) {
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.is_read;
    if (filter === 'success') return notification.type === 'success';
    if (filter === 'error') return notification.type === 'error';
    return true;
  });

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.processo_id && onNavigateToProcessDetail) {
      onNavigateToProcessDetail(notification.processo_id);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleOpenDeleteModal = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    setNotificationToDelete(notificationId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!notificationToDelete) return;

    try {
      console.log('[NotificationsPage] Deletando notificação:', notificationToDelete);
      await deleteNotification(notificationToDelete);
      console.log('[NotificationsPage] Notificação deletada com sucesso');
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    } catch (error) {
      console.error('[NotificationsPage] Erro ao deletar notificação:', error);
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      console.log('[NotificationsPage] Deletando todas as notificações');
      await deleteAllNotifications();
      console.log('[NotificationsPage] Todas as notificações deletadas com sucesso');
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error('[NotificationsPage] Erro ao apagar notificações:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'} atrás`;
    } else if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'} atrás`;
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToSettings={onNavigateToSettings || onNavigateToAdmin}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={() => {
          window.history.pushState({}, '', '/tokens');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToSubscription={() => {
          window.history.pushState({}, '', '/signature');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onCollapsedChange={setIsSidebarCollapsed}
        onSearchClick={() => {}}
        activePage="notifications"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out overflow-x-hidden`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6">
              <Bell className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.textPrimary }} />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-title font-normal" style={{ color: colors.textPrimary }}>
                Notificações
              </h1>
            </div>

            {unreadCount > 0 && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 whitespace-nowrap"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.border}`
                  }}
                >
                  <Check className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium">Marcar todas como lidas</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-6">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  filter === 'all' ? 'scale-105' : ''
                }`}
                style={{
                  backgroundColor: filter === 'all' ? colors.textPrimary : colors.bgSecondary,
                  color: filter === 'all' ? colors.bgPrimary : colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="truncate">Todas ({notifications.length})</span>
                </span>
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  filter === 'unread' ? 'scale-105' : ''
                }`}
                style={{
                  backgroundColor: filter === 'unread' ? colors.textPrimary : colors.bgSecondary,
                  color: filter === 'unread' ? colors.bgPrimary : colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
              >
                <span className="truncate">Não lidas ({unreadCount})</span>
              </button>
              <button
                onClick={() => setFilter('success')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  filter === 'success' ? 'scale-105' : ''
                }`}
                style={{
                  backgroundColor: filter === 'success' ? '#22c55e' : colors.bgSecondary,
                  color: filter === 'success' ? '#fff' : colors.textPrimary,
                  border: `1px solid ${filter === 'success' ? '#22c55e' : colors.border}`
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="truncate">Sucesso ({notifications.filter(n => n.type === 'success').length})</span>
                </span>
              </button>
              <button
                onClick={() => setFilter('error')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  filter === 'error' ? 'scale-105' : ''
                }`}
                style={{
                  backgroundColor: filter === 'error' ? '#ef4444' : colors.bgSecondary,
                  color: filter === 'error' ? '#fff' : colors.textPrimary,
                  border: `1px solid ${filter === 'error' ? '#ef4444' : colors.border}`
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="truncate">Erro ({notifications.filter(n => n.type === 'error').length})</span>
                </span>
              </button>
              {notifications.length > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="col-span-2 sm:col-span-1 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: '1px solid #dc2626'
                  }}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Apagar Todas</span>
                  </span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.textPrimary }}></div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-lg p-12 text-center" style={{ backgroundColor: colors.bgSecondary }}>
              <Bell className="w-16 h-16 mx-auto mb-4 opacity-40" style={{ color: colors.textSecondary }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: colors.textPrimary }}>
                Nenhuma notificação
              </h3>
              <p style={{ color: colors.textSecondary }}>
                {filter === 'all'
                  ? 'Você não tem notificações no momento'
                  : `Você não tem notificações do tipo "${filter === 'unread' ? 'não lidas' : filter}"`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="rounded-lg p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg relative group"
                  style={{
                    backgroundColor: notification.is_read ? colors.bgSecondary : colors.bgTertiary,
                    border: `1px solid ${colors.border}`,
                    opacity: notification.is_read ? 0.7 : 1
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {notification.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1 break-words" style={{ color: colors.textPrimary }}>
                        {notification.message}
                      </p>
                      {notification.processo && (
                        <p className="text-xs sm:text-sm mb-2 truncate" style={{ color: colors.textSecondary }}>
                          Processo: {notification.processo.file_name}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: colors.textSecondary }}>
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex sm:flex-row flex-col items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 sm:opacity-0 sm:group-hover:opacity-100"
                          style={{
                            backgroundColor: colors.bgPrimary,
                            color: colors.textPrimary
                          }}
                          title="Marcar como lida"
                        >
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleOpenDeleteModal(e, notification.id)}
                        className="p-1.5 sm:p-2 rounded-lg transition-all duration-200 hover:scale-110 sm:opacity-0 sm:group-hover:opacity-100"
                        style={{
                          backgroundColor: colors.bgPrimary,
                          color: '#C8C8C8'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(200, 200, 200, 0.1)';
                          e.currentTarget.style.color = '#A0A0A0';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.bgPrimary;
                          e.currentTarget.style.color = '#C8C8C8';
                        }}
                        title="Excluir notificação"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
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

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => {
            setShowDeleteModal(false);
            setNotificationToDelete(null);
          }}
        >
          <div
            className="rounded-lg shadow-xl max-w-md w-full p-6"
            style={{ backgroundColor: colors.bgPrimary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(200, 200, 200, 0.1)' }}>
                <Trash2 className="w-6 h-6" style={{ color: '#C8C8C8' }} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                Excluir notificação?
              </h3>
            </div>

            <p className="mb-6" style={{ color: colors.textSecondary }}>
              Esta ação não pode ser desfeita. Esta notificação será permanentemente excluída.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setNotificationToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-700"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff'
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowDeleteAllModal(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-md w-full p-6"
            style={{ backgroundColor: colors.bgPrimary }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(200, 200, 200, 0.1)' }}>
                <Trash2 className="w-6 h-6" style={{ color: '#C8C8C8' }} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                Apagar todas as notificações?
              </h3>
            </div>

            <p className="mb-6" style={{ color: colors.textSecondary }}>
              Esta ação não pode ser desfeita. Todas as suas notificações serão permanentemente excluídas.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.border}`
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAllNotifications}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-red-700"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff'
                }}
              >
                Apagar Todas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
