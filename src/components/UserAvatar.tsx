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
    sm: 'w-9 h-9 max-h-900:w-5 max-h-900:h-5 max-h-720:w-2 max-h-720:h-2 text-xs max-h-900:text-[7px] max-h-720:text-[3px]',
    md: 'w-10 h-10 max-h-900:w-6 max-h-900:h-6 max-h-720:w-2.5 max-h-720:h-2.5 text-sm max-h-900:text-[8px] max-h-720:text-[3px]',
    lg: 'w-16 h-16 max-h-900:w-10 max-h-900:h-10 max-h-720:w-5 max-h-720:h-5 text-xl max-h-900:text-xs max-h-720:text-[7px]'
  };

  const getInitials = () => {
    const firstInitial = firstName?.[0]?.toUpperCase() || '';
    const lastInitial = lastName?.[0]?.toUpperCase() || '';
    const initials = `${firstInitial}${lastInitial}`;
    return initials || '?';
  };

  const bgColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(41, 50, 58, 0.1)';
  const textColor = theme === 'dark' ? '#FFFFFF' : '#141312';

  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden ${className}`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {avatarUrl && !imageError ? (
        <img
          src={avatarUrl}
          alt="Avatar"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        getInitials()
      )}
    </div>
  );
}
