import React from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { AchievementProgress } from '../services/UserAchievementsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AchievementBadgeProps {
  achievement: AchievementProgress;
  onNavigateToProfile?: () => void;
  onNavigateToApp?: () => void;
}

export function AchievementBadge({ achievement, onNavigateToProfile, onNavigateToApp }: AchievementBadgeProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { config, unlocked, unlockedAt, progress, currentCount } = achievement;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleClick = () => {
    if (config.type === 'profile_complete' && onNavigateToProfile) {
      onNavigateToProfile();
    } else if (onNavigateToApp) {
      // Leva para a home tanto para conquistas desbloqueadas quanto bloqueadas (exceto profile_complete)
      onNavigateToApp();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative rounded-lg p-6 pb-4 shadow-md transition-all duration-300 cursor-pointer transform hover:scale-105 hover:shadow-lg ${
        !unlocked ? 'opacity-60' : ''
      }`}
      style={{
        background: unlocked
          ? config.badgeGradient
          : theme === 'dark'
          ? colors.bgSecondary
          : '#F3F4F6',
        border: unlocked
          ? 'none'
          : theme === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.2)'
          : '2px solid #D1D5DB'
      }}
    >
      {/* Ícone Principal */}
      <div className="flex flex-col items-center mb-4 pt-2">
        <div
          className={`mb-3 transition-all duration-300 ${
            unlocked ? '' : 'opacity-40'
          }`}
        >
          <config.icon
            className="w-12 h-12"
            style={{
              color: unlocked ? '#FFFFFF' : colors.textSecondary,
              strokeWidth: 1.5
            }}
          />
        </div>

        {/* Título e Descrição */}
        <h3
          className="text-lg font-bold text-center mb-2 px-1"
          style={{
            color: unlocked ? '#FFFFFF' : colors.textPrimary
          }}
        >
          {config.title}
        </h3>
        <p
          className="text-base text-center line-clamp-2 px-1"
          style={{
            color: unlocked ? 'rgba(255, 255, 255, 0.9)' : colors.textSecondary
          }}
        >
          {config.description}
        </p>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-sm font-medium">
          <span
            style={{
              color: unlocked ? 'rgba(255, 255, 255, 0.9)' : colors.textSecondary
            }}
          >
            Progresso
          </span>
          <span
            style={{
              color: unlocked ? '#FFFFFF' : colors.textPrimary
            }}
          >
            {currentCount} / {config.requiredCount}
          </span>
        </div>
        <div
          className="h-2.5 rounded-full overflow-hidden"
          style={{
            backgroundColor: unlocked
              ? 'rgba(255, 255, 255, 0.25)'
              : theme === 'dark'
              ? '#374151'
              : '#E5E7EB'
          }}
        >
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: unlocked ? '#FFFFFF' : config.color
            }}
          />
        </div>
        <div className="text-center">
          <span
            className="text-sm font-semibold"
            style={{
              color: unlocked ? '#FFFFFF' : config.color
            }}
          >
            {progress}%
          </span>
        </div>
      </div>

      {/* Área com altura fixa para data de desbloqueio */}
      <div className={`h-10 mt-3 pt-2 flex items-center justify-center ${unlocked ? 'border-t border-white border-opacity-25' : ''}`}>
        {unlocked && unlockedAt && (
          <p className="text-xs text-center" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Desbloqueado em {formatDate(unlockedAt)}
          </p>
        )}
      </div>

      {/* Badge de Status - Altura fixa no final */}
      <div className="flex justify-center h-7 items-center mb-0.5">
        {unlocked ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Desbloqueado</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold"
            style={{
              backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
              color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
              fontSize: '0.875rem'
            }}
          >
            <Lock className="w-4 h-4" />
            <span>Bloqueado</span>
          </div>
        )}
      </div>

    </div>
  );
}
