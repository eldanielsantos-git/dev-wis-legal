import React, { useState, useEffect, useRef } from 'react';
import { Clock, Loader, Layers, Brain, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { DetailedProgressInfo } from '../lib/supabase';

interface ProcessStep {
  status: string[];
  label: string;
  icon: React.ElementType;
  percentage: number;
}

interface ProcessStatusProgressProps {
  status: string;
  finalizationProgress?: number;
  progressInfo?: DetailedProgressInfo;
}

export const ProcessStatusProgress: React.FC<ProcessStatusProgressProps> = ({
  status,
  finalizationProgress = 0,
  progressInfo
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [interpolatedProgress, setInterpolatedProgress] = useState<number>(0);
  const lastRealProgressRef = useRef<number>(0);
  const statusStartTimeRef = useRef<number>(Date.now());

  const calculateDetailedProgress = (): number => {
    if (status === 'completed') return 100;

    if (status === 'queuing') {
      if (progressInfo?.substep_progress !== undefined) {
        return 5 + (progressInfo.substep_progress * 0.15);
      }
      return 10;
    }

    if (status === 'processing_batch') {
      if (progressInfo?.substep_progress !== undefined) {
        return 20 + (progressInfo.substep_progress * 0.20);
      }
      return 30;
    }

    if (status === 'finalizing') {
      const filesProgress = progressInfo?.filesProcessed && progressInfo?.totalFiles
        ? (progressInfo.filesProcessed / progressInfo.totalFiles) * 100
        : finalizationProgress;

      return 40 + (filesProgress * 0.30);
    }

    if (status === 'processing_forensic') {
      if (progressInfo?.chunks_completed && progressInfo?.total_chunks) {
        const chunkProgress = (progressInfo.chunks_completed / progressInfo.total_chunks) * 100;
        return 70 + (chunkProgress * 0.25);
      }
      if (progressInfo?.consolidation_phase) {
        return 90 + (progressInfo.consolidation_phase * 2);
      }
      return 80;
    }

    return 5;
  };

  const getProgressRange = (currentStatus: string): { min: number; max: number; estimatedDuration: number } => {
    switch (currentStatus) {
      case 'queuing':
        return { min: 5, max: 20, estimatedDuration: 10000 };
      case 'processing_batch':
        return { min: 20, max: 40, estimatedDuration: 30000 };
      case 'finalizing':
        return { min: 40, max: 70, estimatedDuration: 60000 };
      case 'processing_forensic':
        return { min: 70, max: 95, estimatedDuration: 90000 };
      default:
        return { min: 5, max: 20, estimatedDuration: 10000 };
    }
  };

  useEffect(() => {
    const realProgress = calculateDetailedProgress();

    if (realProgress !== lastRealProgressRef.current) {
      lastRealProgressRef.current = realProgress;
      setInterpolatedProgress(realProgress);
      statusStartTimeRef.current = Date.now();
      return;
    }

    if (status === 'completed' || status === 'error') {
      return;
    }

    const range = getProgressRange(status);
    const maxProgressInRange = range.max - 2;

    const interval = setInterval(() => {
      const elapsed = Date.now() - statusStartTimeRef.current;
      const progressRate = (range.max - range.min) / range.estimatedDuration;
      const timeBasedIncrement = elapsed * progressRate;

      const newProgress = Math.min(
        lastRealProgressRef.current + timeBasedIncrement,
        maxProgressInRange
      );

      if (newProgress > interpolatedProgress && newProgress < maxProgressInRange) {
        setInterpolatedProgress(newProgress);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [status, progressInfo, finalizationProgress, interpolatedProgress]);

  const currentProgress = interpolatedProgress || calculateDetailedProgress();

  const steps: ProcessStep[] = [
    {
      status: ['created', 'queuing'],
      label: 'Enviando',
      icon: Loader,
      percentage: 10
    },
    {
      status: ['processing_batch'],
      label: 'Processando',
      icon: Loader,
      percentage: 40
    },
    {
      status: ['finalizing'],
      label: 'Extraindo',
      icon: Layers,
      percentage: 70
    },
    {
      status: ['processing_forensic'],
      label: 'Análise',
      icon: Brain,
      percentage: 95
    },
    {
      status: ['completed'],
      label: 'Concluído',
      icon: CheckCircle,
      percentage: 100
    }
  ];

  const currentStep = steps.find(step => step.status.includes(status)) || steps[0];
  const CurrentIcon = currentStep.icon;

  const getSubstepLabel = (): string => {
    if (progressInfo?.substep_description) {
      return progressInfo.substep_description;
    }
    return currentStep.label;
  };

  const formatETA = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const eta = new Date(isoString);
      const now = new Date();
      const diffMs = eta.getTime() - now.getTime();
      if (diffMs <= 0) return '';

      const diffMinutes = Math.ceil(diffMs / 60000);
      if (diffMinutes < 60) return `~${diffMinutes}min`;

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `~${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2">
            <CurrentIcon
              className={`w-4 h-4 ${
                (status === 'queuing' || status === 'processing_batch' || status === 'finalizing' || status === 'processing_forensic') ? 'animate-spin' : ''
              }`}
              style={{ color: isDark ? '#FFFFFF' : '#141312' }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: isDark ? '#D1D5DB' : '#374151' }}
            >
              {currentStep.label}
            </span>
          </div>
          {progressInfo?.substep_description && (
            <span
              className="text-xs ml-6 transition-all duration-300"
              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
            >
              {getSubstepLabel()}
            </span>
          )}
          {progressInfo?.estimated_completion_time && formatETA(progressInfo.estimated_completion_time) && (
            <span
              className="text-xs ml-6 transition-all duration-300"
              style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
            >
              ETA: {formatETA(progressInfo.estimated_completion_time)}
            </span>
          )}
        </div>
        <span
          className="text-sm font-semibold"
          style={{ color: isDark ? '#FFFFFF' : '#141312' }}
        >
          {Math.round(currentProgress)}%
        </span>
      </div>

      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }}
      >
        <div
          className="h-full transition-all duration-700 ease-in-out rounded-full relative overflow-hidden"
          style={{
            width: `${currentProgress}%`,
            backgroundColor: isDark ? '#FFFFFF' : '#141312',
            transitionProperty: 'width'
          }}
        >
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              backgroundSize: '200% 100%'
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = step.percentage <= currentProgress;
          const isCurrent = step.status.includes(status);

          return (
            <div
              key={index}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCurrent ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{
                  backgroundColor: isCompleted
                    ? (isDark ? '#FFFFFF' : '#141312')
                    : (isDark ? '#374151' : '#D1D5DB'),
                  ringColor: isDark ? '#FFFFFF' : '#141312',
                  ringOffsetColor: isDark ? '#14181B' : '#FFFFFF'
                }}
              >
                <StepIcon
                  className={`w-3 h-3 ${
                    isCurrent && (status === 'queuing' || status === 'processing_batch' || status === 'finalizing' || status === 'processing_forensic') ? 'animate-spin' : ''
                  }`}
                  style={{ color: isCompleted ? '#FFFFFF' : (isDark ? '#6B7280' : '#9CA3AF') }}
                />
              </div>
              <span
                className={`text-[10px] text-center max-w-[60px] leading-tight ${
                  isCurrent ? 'font-semibold' : 'font-normal'
                }`}
                style={{
                  color: isCompleted
                    ? (isDark ? '#D1D5DB' : '#374151')
                    : (isDark ? '#6B7280' : '#9CA3AF')
                }}
              >
                {step.label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};
