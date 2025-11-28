import React from 'react';
import { X, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AudioRecordingAnimationProps {
  recordingTime: number;
  onCancel: () => void;
  onStop: () => void;
}

export function AudioRecordingAnimation({ recordingTime, onCancel, onStop }: AudioRecordingAnimationProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between px-5 pb-4 pt-3 min-h-[80px]">
      <div className="flex items-center gap-2">
        <div className="relative flex items-center justify-center w-9 h-9 ml-2">
          <div
            className="absolute w-9 h-9 rounded-full animate-ping opacity-75"
            style={{ backgroundColor: '#ef4444' }}
          />
          <div
            className="relative w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#dc2626' }}
          >
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        </div>

        <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444'
          }}
          title="Cancelar gravação"
        >
          <X className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onStop}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: theme === 'dark' ? '#FFFFFF' : '#141312',
            color: theme === 'dark' ? '#141312' : '#FFFFFF'
          }}
          title="Enviar áudio"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
