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
    sm: 'w-9 h-9 lg:max-h-[900px]:w-5 lg:max-h-[900px]:h-5 lg:max-h-[720px]:w-4 lg:max-h-[720px]:h-4 text-xs lg:max-h-[900px]:text-[7px] lg:max-h-[720px]:text-[6px]',
    md: 'w-10 h-10 lg:max-h-[900px]:w-6 lg:max-h-[900px]:h-6 lg:max-h-[720px]:w-5 lg:max-h-[720px]:h-5 text-sm lg:max-h-[900px]:text-[8px] lg:max-h-[720px]:text-[7px]',
    lg: 'w-16 h-16 lg:max-h-[900px]:w-10 lg:max-h-[900px]:h-10 lg:max-h-[720px]:w-8 lg:max-h-[720px]:h-8 text-xl lg:max-h-[900px]:text-xs lg:max-h-[720px]:text-[10px]'
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
