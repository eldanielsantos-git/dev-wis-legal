import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserAvatar({ avatarUrl, firstName, lastName, size = 'md', className = '' }: UserAvatarProps) {
  const { theme } = useTheme();

  const sizeClasses = {
    sm: 'w-9 h-9 max-h-[790px]:w-6 max-h-[790px]:h-6 text-xs max-h-[790px]:text-[8px]',
    md: 'w-10 h-10 max-h-[790px]:w-7 max-h-[790px]:h-7 text-sm max-h-[790px]:text-[10px]',
    lg: 'w-16 h-16 max-h-[790px]:w-12 max-h-[790px]:h-12 text-xl max-h-[790px]:text-base'
  };

  const getInitials = () => {
    const firstInitial = firstName?.[0]?.toUpperCase() || '';
    const lastInitial = lastName?.[0]?.toUpperCase() || '';
    const initials = `${firstInitial}${lastInitial}`;
    return initials || '?';
  };

  const bgColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(41, 50, 58, 0.1)';
  const textColor = theme === 'dark' ? '#FFFFFF' : '#141312';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-full h-full object-cover"
        />
      ) : (
        getInitials()
      )}
    </div>
  );
}
