import React from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { AchievementProgress } from '../services/UserAchievementsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AchievementBadgeProps {
  achievement: AchievementProgress;
}

export function AchievementBadge({ achievement }: AchievementBadgeProps) {
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

  return (
    <div
      className={`relative rounded-xl p-6 shadow-lg transition-all duration-300 ${
        unlocked ? 'transform hover:scale-105 hover:shadow-xl' : 'opacity-60'
      }`}
      style={{
        background: unlocked
          ? config.badgeGradient
          : theme === 'dark'
          ? colors.bgSecondary
          : '#F3F4F6',
        border: unlocked
          ? 'none'
          : `2px solid ${theme === 'dark' ? '#374151' : '#D1D5DB'}`
      }}
    >
      {/* Badge de Status */}
      <div className="absolute top-3 right-3">
        {unlocked ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF'
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Desbloqueado</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
              color: theme === 'dark' ? '#9CA3AF' : '#6B7280'
            }}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloqueado</span>
          </div>
        )}
      </div>

      {/* Ícone Principal */}
      <div className="flex flex-col items-center mb-4">
        <div
          className={`text-6xl mb-3 transition-all duration-300 ${
            unlocked ? 'animate-pulse' : 'grayscale'
          }`}
        >
          {config.icon}
        </div>

        {/* Título e Descrição */}
        <h3
          className="text-xl font-bold text-center mb-2"
          style={{
            color: unlocked ? '#FFFFFF' : colors.textPrimary
          }}
        >
          {config.title}
        </h3>
        <p
          className="text-sm text-center"
          style={{
            color: unlocked ? 'rgba(255, 255, 255, 0.9)' : colors.textSecondary
          }}
        >
          {config.description}
        </p>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-xs font-medium">
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
          className="h-2 rounded-full overflow-hidden"
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
            className="text-xs font-semibold"
            style={{
              color: unlocked ? '#FFFFFF' : config.color
            }}
          >
            {progress}%
          </span>
        </div>
      </div>

      {/* Data de Desbloqueio */}
      {unlocked && unlockedAt && (
        <div className="mt-4 pt-4 border-t border-white border-opacity-25">
          <p className="text-xs text-center" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Desbloqueado em {formatDate(unlockedAt)}
          </p>
        </div>
      )}

      {/* Efeito de Brilho quando desbloqueado */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background:
              'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
            animation: 'shimmer 3s infinite'
          }}
        />
      )}
    </div>
  );
}
