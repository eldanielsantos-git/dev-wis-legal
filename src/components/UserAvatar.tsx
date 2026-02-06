import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isAdmin?: boolean;
}

export function UserAvatar({ avatarUrl, firstName, lastName, size = 'md', className = '', isAdmin = false }: UserAvatarProps) {
  const { theme } = useTheme();

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl'
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

  const adminBorderClass = isAdmin ? 'ring-2 ring-purple-500' : '';

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden ${adminBorderClass} ${className}`}
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
