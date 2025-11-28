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
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  description,
  trend
}) => {
  const { theme } = useTheme();

  return (
    <div
      className="rounded-lg sm:rounded-xl border p-3 sm:p-4 lg:p-6 hover:shadow-lg transition-all duration-300 max-w-sm"
      style={{
        backgroundColor: theme === 'dark' ? '#1D1C1B' : '#FFFFFF',
        borderColor: theme === 'dark' ? 'transparent' : '#E5E7EB'
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`p-2 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl ${iconBg} mb-3`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 ${iconColor}`} />
        </div>
        <p className="text-xs sm:text-sm font-medium mb-1" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>{title}</p>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: theme === 'dark' ? '#C8C8C8' : '#1F2937' }}>{value}</p>
        {description && (
          <p className="text-[10px] sm:text-xs mt-1 sm:mt-2" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>{description}</p>
        )}
        {trend && (
          <div className="flex items-center justify-center mt-1 sm:mt-2">
            <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs ml-1 hidden sm:inline" style={{ color: theme === 'dark' ? '#8B8B8B' : '#6B7280' }}>vs. último mês</span>
          </div>
        )}
      </div>
    </div>
  );
};
