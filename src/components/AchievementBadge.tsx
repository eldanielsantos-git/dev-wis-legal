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
      className={`relative rounded-lg p-4 pb-3 shadow-md transition-all duration-300 ${
        unlocked ? 'transform hover:scale-105 hover:shadow-lg' : 'opacity-60'
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
      {/* Ícone Principal */}
      <div className="flex flex-col items-center mb-4 pt-2">
        <div
          className={`text-4xl mb-2.5 transition-all duration-300 ${
            unlocked ? 'animate-pulse' : 'grayscale'
          }`}
        >
          {config.icon}
        </div>

        {/* Título e Descrição */}
        <h3
          className="text-sm font-bold text-center mb-1.5 px-1"
          style={{
            color: unlocked ? '#FFFFFF' : colors.textPrimary
          }}
        >
          {config.title}
        </h3>
        <p
          className="text-xs text-center line-clamp-2 px-1"
          style={{
            color: unlocked ? 'rgba(255, 255, 255, 0.9)' : colors.textSecondary
          }}
        >
          {config.description}
        </p>
      </div>

      {/* Barra de Progresso */}
      <div className="mt-4 space-y-1.5">
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
          className="h-1.5 rounded-full overflow-hidden"
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

      {/* Área com altura fixa para data de desbloqueio */}
      <div className={`h-14 mt-4 pt-3 flex items-center justify-center ${unlocked ? 'border-t border-white border-opacity-25' : ''}`}>
        {unlocked && unlockedAt && (
          <p className="text-xs text-center" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            Desbloqueado em {formatDate(unlockedAt)}
          </p>
        )}
      </div>

      {/* Badge de Status - Altura fixa no final */}
      <div className="flex justify-center h-7 items-center mb-1">
        {unlocked ? (
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              fontSize: '0.65rem'
            }}
          >
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Desbloqueado</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB',
              color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
              fontSize: '0.65rem'
            }}
          >
            <Lock className="w-2.5 h-2.5" />
            <span>Bloqueado</span>
          </div>
        )}
      </div>

      {/* Efeito de Brilho quando desbloqueado */}
      {unlocked && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
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
