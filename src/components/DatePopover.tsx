import React, { useEffect, useRef } from 'react';
import { Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ProcessDeadline } from '../types/analysis';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface DatePopoverProps {
  date: Date;
  deadlines: ProcessDeadline[];
  position: { x: number; y: number };
  onClose: () => void;
  onViewDeadline: (deadline: ProcessDeadline) => void;
  onCreateDeadline: () => void;
}

export const DatePopover: React.FC<DatePopoverProps> = ({
  date,
  deadlines,
  position,
  onClose,
  onViewDeadline,
  onCreateDeadline
}) => {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4" style={{ color: colors.textSecondary }} />;
    }
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-lg shadow-2xl border transition-all duration-200"
      style={{
        backgroundColor: colors.bgSecondary,
        borderColor: colors.border,
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '280px',
        maxWidth: '320px',
        opacity: 1,
        transform: 'scale(1)'
      }}
    >
      <div className="p-4">
        <div className="mb-3 pb-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
          <h3 className="font-semibold text-sm" style={{ color: colors.textPrimary }}>
            {formatDate(date)}
          </h3>
        </div>

        {deadlines.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium mb-2" style={{ color: colors.textSecondary }}>
              Prazos ({deadlines.length})
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {deadlines.map(deadline => (
                <button
                  key={deadline.id}
                  onClick={() => {
                    onViewDeadline(deadline);
                    onClose();
                  }}
                  className="w-full text-left p-2 rounded-lg hover:opacity-80 transition-all"
                  style={{ backgroundColor: colors.bgPrimary }}
                >
                  <div className="flex items-start gap-2">
                    {getStatusIcon(deadline.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                        {deadline.subject}
                      </p>
                      {deadline.deadline_time && (
                        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: colors.textSecondary }}>
                          <Clock className="w-3 h-3" />
                          {formatTime(deadline.deadline_time)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            onCreateDeadline();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-all"
          style={{
            backgroundColor: colors.accent,
            color: '#ffffff'
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Criar Novo Prazo</span>
        </button>
      </div>
    </div>
  );
};
