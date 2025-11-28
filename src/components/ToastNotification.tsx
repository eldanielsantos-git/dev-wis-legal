import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastNotificationProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  id,
  type,
  message,
  duration = 5000,
  onClose
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    if (theme === 'dark') {
      return '#1F2229';
    }
    return '#FFFFFF';
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
    }
  };

  return (
    <div
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg shadow-lg border-l-4 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
      style={{
        backgroundColor: getBgColor(),
        borderLeftColor: getBorderColor(),
        minWidth: '320px',
        maxWidth: '480px',
      }}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <p
        className="flex-1 text-sm font-medium"
        style={{ color: theme === 'dark' ? '#E5E7EB' : '#374151' }}
      >
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(id), 300);
        }}
        className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        style={{ color: theme === 'dark' ? '#9CA3AF' : '#6B7280' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
