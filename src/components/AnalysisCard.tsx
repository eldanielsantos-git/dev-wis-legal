import React from 'react';
import { Loader, CheckCircle, AlertCircle, Eye, FileText, Calendar, Scale, Lightbulb, AlertTriangle, DollarSign, Lock, Target } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface AnalysisCardProps {
  number: number;
  title: string;
  status: 'pending' | 'processing' | 'running' | 'completed' | 'failed' | 'error';
  isSelected: boolean;
  onClick: () => void;
  executionTimeMs?: number;
  isAvailable?: boolean;
}

const getAnalysisIcon = (number: number) => {
  const iconProps = { className: "w-3.5 h-3.5 sm:w-6 sm:h-6" };
  switch (number) {
    case 1: return <Eye {...iconProps} />;
    case 2: return <FileText {...iconProps} />;
    case 3: return <Calendar {...iconProps} />;
    case 4: return <Scale {...iconProps} />;
    case 5: return <Lightbulb {...iconProps} />;
    case 6: return <AlertTriangle {...iconProps} />;
    case 7: return <DollarSign {...iconProps} />;
    case 8: return <Lock {...iconProps} />;
    case 9: return <Target {...iconProps} />;
    default: return <FileText {...iconProps} />;
  }
};

const getIconColor = (number: number): string => {
  switch (number) {
    case 1: return '#3B82F6'; // blue
    case 2: return '#8B5CF6'; // purple
    case 3: return '#10B981'; // green
    case 4: return '#F59E0B'; // amber
    case 5: return '#06B6D4'; // cyan
    case 6: return '#EF4444'; // red
    case 7: return '#14B8A6'; // teal
    case 8: return '#F97316'; // orange
    case 9: return '#EC4899'; // pink
    default: return '#6B7280'; // gray
  }
};

export function AnalysisCard({
  number,
  title,
  status,
  isSelected,
  onClick,
  executionTimeMs,
  isAvailable = true,
}: AnalysisCardProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const getMainIcon = () => {
    const iconColor = getIconColor(number);

    // Loading state (running or processing) - sempre mostra spinner para esses estados
    const isProcessing = status === 'running' || status === 'processing';

    if (isProcessing) {
      return <Loader className="w-3.5 h-3.5 sm:w-6 sm:h-6 animate-spin" style={{ color: iconColor }} />;
    }

    // Completed state - mostra ícone normal com check
    if (status === 'completed') {
      return (
        <div style={{ color: iconColor, opacity: 1 }}>
          {getAnalysisIcon(number)}
        </div>
      );
    }

    // Pending state - mostra ícone com opacidade reduzida
    const baseOpacity = 0.4;
    const finalOpacity = theme === 'dark' ? baseOpacity * 0.5 : baseOpacity;

    return (
      <div style={{ color: iconColor, opacity: finalOpacity }}>
        {getAnalysisIcon(number)}
      </div>
    );
  };

  const isClickable = status === 'completed';
  const isProcessing = status === 'running' || status === 'processing';

  // Opacidade do botão baseada no status
  const getButtonOpacity = () => {
    if (status === 'completed') return 1;
    if (isProcessing) return 1;
    if (status === 'pending') return 0.6;
    return 1;
  };

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      title={title}
      className="flex items-center justify-center rounded-lg transition-opacity duration-200 hover:opacity-70 disabled:hover:opacity-100 flex-shrink-0 w-8 h-8 sm:w-12 sm:h-12"
      style={{
        backgroundColor: theme === 'dark' ? '#141312' : colors.bgSecondary,
        border: 'none',
        cursor: isClickable ? 'pointer' : 'default',
        opacity: getButtonOpacity(),
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {getMainIcon()}
    </button>
  );
}
