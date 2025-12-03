import React from 'react';
import { Video as LucideIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface StatusCardProps {
  title: string;
  value: string | number;
  icon: typeof LucideIcon;
  iconColor: string;
  iconBg: string;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  description,
  trend,
  onClick
}) => {
  const { theme } = useTheme();

  return (
    <div
      onClick={onClick}
      className="rounded-lg sm:rounded-xl border p-3 sm:p-4 max-h-[785px]:p-2 max-h-[785px]:sm:p-3 hover:shadow-lg transition-all duration-300 max-w-[280px] w-full cursor-pointer"
      style={{
        backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
        borderColor: theme === 'dark' ? 'transparent' : '#E5E7EB'
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`p-2 sm:p-2.5 max-h-[785px]:p-1.5 max-h-[785px]:sm:p-2 rounded-lg sm:rounded-xl ${iconBg} mb-2.5 max-h-[785px]:mb-2`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 max-h-[785px]:w-4 max-h-[785px]:h-4 max-h-[785px]:sm:w-5 max-h-[785px]:sm:h-5 ${iconColor}`} />
        </div>
        <p className="text-xs max-h-[785px]:text-[10px] font-medium mb-1.5 max-h-[785px]:mb-1" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>{title}</p>
        <p className="text-2xl sm:text-3xl max-h-[785px]:text-xl max-h-[785px]:sm:text-2xl font-bold mb-1" style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}>{value}</p>
        {description && (
          <p className="text-[10px] sm:text-xs max-h-[785px]:text-[9px] max-h-[785px]:sm:text-[10px]" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>{description}</p>
        )}
        {trend && (
          <div className="flex items-center justify-center mt-1.5 max-h-[785px]:mt-1">
            <span className={`text-xs max-h-[785px]:text-[10px] font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs max-h-[785px]:text-[10px] ml-1 hidden sm:inline" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>vs. último mês</span>
          </div>
        )}
      </div>
    </div>
  );
};
