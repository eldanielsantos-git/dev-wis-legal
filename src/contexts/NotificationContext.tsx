import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { NotificationsService, Notification } from '../services/NotificationsService';
import { useAuth } from './AuthContext';
import { playErrorSound } from '../utils/notificationSound';
import { logger } from '../utils/logger';

interface NotificationCounts {
  success: number;
  error: number;
  total: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCounts: NotificationCounts;
  loading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<NotificationCounts>({
    success: 0,
    error: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const isLoadingNotifications = useRef(false);
  const hasLoadedInitial = useRef(false);

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCounts({ success: 0, error: 0, total: 0 });
      setLoading(false);
      hasLoadedInitial.current = false;
      return;
    }

    if (isLoadingNotifications.current) {
      logger.log('NotificationContext', 'Already loading notifications, skipping duplicate call');
      return;
    }

    isLoadingNotifications.current = true;

    try {
      logger.log('NotificationContext', 'Carregando notificações...');
      const [notifs, counts] = await Promise.all([
        NotificationsService.getNotifications(),
        NotificationsService.getUnreadCount()
      ]);

      logger.log('NotificationContext', 'Notificações carregadas:', notifs.length);
      setNotifications(notifs);
      setUnreadCounts(counts);
      hasLoadedInitial.current = true;
    } catch (error) {
      logger.error('NotificationContext', 'Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
      isLoadingNotifications.current = false;
    }
  };

  useEffect(() => {
    if (!hasLoadedInitial.current) {
      loadNotifications();
    }

    if (!user) return;

    const subscription = NotificationsService.subscribeToNotifications((updatedNotifications) => {
      logger.log('NotificationContext', 'Recebeu atualização via subscription:', updatedNotifications.length, 'notificações');
      setNotifications(updatedNotifications);

      NotificationsService.getUnreadCount().then(counts => {
        setUnreadCounts(counts);
      });

      if (updatedNotifications.length > 0 && lastNotificationId !== updatedNotifications[0].id) {
        const latestNotif = updatedNotifications[0];
        if (!latestNotif.is_read) {
          if (latestNotif.type === 'error') {
            playErrorSound();
          }
          setLastNotificationId(latestNotif.id);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user, lastNotificationId]);

  const markAsRead = async (notificationId: string) => {
    await NotificationsService.markAsRead(notificationId);
    await loadNotifications();
  };

  const markAllAsRead = async () => {
    await NotificationsService.markAllAsRead();
    await loadNotifications();
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      logger.log('NotificationContext', 'Iniciando delete de notificação:', notificationId);
      await NotificationsService.deleteNotification(notificationId);
      logger.log('NotificationContext', 'Delete bem sucedido, recarregando notificações');
      await loadNotifications();
    } catch (error) {
      logger.error('NotificationContext', 'Erro ao deletar notificação:', error);
      throw error;
    }
  };

  const deleteAllNotifications = async () => {
    try {
      logger.log('NotificationContext', 'Iniciando delete de todas as notificações');
      await NotificationsService.deleteAllNotifications();
      logger.log('NotificationContext', 'Delete de todas bem sucedido, recarregando notificações');
      await loadNotifications();
    } catch (error) {
      logger.error('NotificationContext', 'Erro ao deletar todas as notificações:', error);
      throw error;
    }
  };

  const refreshNotifications = async () => {
    await loadNotifications();
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCounts,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        refreshNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
