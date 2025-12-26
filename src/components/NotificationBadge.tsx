import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface NotificationBadgeProps {
  onClick?: () => void;
  isCollapsed?: boolean;
  isActive?: boolean;
}

export function NotificationBadge({ onClick, isCollapsed, isActive }: NotificationBadgeProps) {
  const { unreadCounts } = useNotifications();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const hasUnread = unreadCounts.total > 0;
  const hasSuccess = unreadCounts.success > 0;
  const hasError = unreadCounts.error > 0;

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current && showTooltip) {
        const rect = buttonRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 8
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showTooltip]);

  const getMessage = () => {
    if (hasError && hasSuccess) {
      return 'Você tem notificações de sucesso e erro';
    } else if (hasSuccess) {
      return 'A análise do seu processo está pronta!';
    } else if (hasError) {
      return 'Houve alguma falha no processamento do seu arquivo. Exclua o item atual e tente novamente.';
    }
    return 'Sem notificações';
  };

  const getBadgeColor = () => {
    if (hasError) return '#ef4444';
    if (hasSuccess) return '#22c55e';
    return 'transparent';
  };

  const hoverBg = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const activeBg = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  const tooltipContent = showTooltip && (
    <div
      ref={tooltipRef}
      className="fixed min-w-[280px] max-w-[320px] px-4 py-3 rounded-lg shadow-2xl"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        transform: 'translateY(-50%)',
        zIndex: 99999,
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${colors.border}`
      }}
    >
      {hasUnread ? (
        <>
          {isCollapsed ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4" style={{ color: colors.textPrimary }} />
                <span className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                  {unreadCounts.total} {unreadCounts.total === 1 ? 'notificação' : 'notificações'}
                </span>
              </div>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {getMessage()}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {getMessage()}
            </p>
          )}
          {hasSuccess && hasError && (
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-green-600 font-semibold">{unreadCounts.success} sucesso</span>
              <span className="text-red-600 font-semibold">{unreadCounts.error} erro(s)</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
          Notificações
        </p>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-full flex items-center py-[18px] lg:max-h-[900px]:py-0.5 lg:max-h-[700px]:py-0 rounded-lg transition-colors relative ${isCollapsed ? 'justify-center' : 'px-4 lg:max-h-[900px]:px-0.5 lg:max-h-[700px]:px-0'}`}
        style={{ color: colors.textPrimary, backgroundColor: isActive ? activeBg : 'transparent' }}
        onMouseEnterCapture={(e: any) => e.currentTarget.style.backgroundColor = hoverBg}
        onMouseLeaveCapture={(e: any) => e.currentTarget.style.backgroundColor = isActive ? activeBg : 'transparent'}
        title={isCollapsed ? "Notificações" : undefined}
      >
        <div className="relative">
          <Bell className={`w-5 h-5 lg:max-h-[900px]:w-3 lg:max-h-[900px]:h-3 lg:max-h-[720px]:w-2 lg:max-h-[720px]:h-2 flex-shrink-0 ${hasUnread ? 'animate-pulse' : ''}`} />
          {hasUnread && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 lg:max-h-[900px]:w-2 lg:max-h-[900px]:h-2 lg:max-h-[720px]:w-1 lg:max-h-[720px]:h-1 rounded-full text-white text-xs lg:max-h-[900px]:text-[7px] lg:max-h-[720px]:text-[4px] flex items-center justify-center font-bold"
              style={{ backgroundColor: getBadgeColor(), fontSize: '10px' }}
            >
              {unreadCounts.total > 9 ? '9+' : unreadCounts.total}
            </span>
          )}
        </div>
        {!isCollapsed && <span className="ml-3 lg:max-h-[900px]:ml-0.5 lg:max-h-[720px]:ml-0 text-sm lg:max-h-[900px]:text-[9px] lg:max-h-[720px]:text-[6px] font-medium">Notificações</span>}
      </button>

      {tooltipContent && createPortal(tooltipContent, document.body)}
    </div>
  );
}
