import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from './UserAvatar';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getThemeColors } from '../utils/themeUtils';
import { User, CreditCard, LogOut } from 'lucide-react';

interface UserAvatarMenuProps {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  onEditProfile?: () => void;
  onViewSubscription?: () => void;
  className?: string;
  showLabel?: boolean;
  isAdmin?: boolean;
}

export function UserAvatarMenu({
  avatarUrl,
  firstName,
  lastName,
  size = 'md',
  onEditProfile,
  onViewSubscription,
  className = '',
  showLabel = true,
  isAdmin = false
}: UserAvatarMenuProps) {
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const colors = getThemeColors(theme);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current && isOpen) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom - 120,
          left: rect.right + 8
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleClick = () => {
    onEditProfile?.();
  };

  const handleEditProfile = () => {
    setIsOpen(false);
    onEditProfile?.();
  };

  const handleViewSubscription = () => {
    setIsOpen(false);
    onViewSubscription?.();
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const menuContent = isOpen && (
    <div
      ref={menuRef}
      className="fixed min-w-[224px] rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        zIndex: 99999,
        backgroundColor: colors.bgSecondary,
        border: `1px solid ${colors.border}`
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleEditProfile}
        className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          color: colors.textPrimary,
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bgTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <User className="w-5 h-5" style={{ color: colors.textSecondary }} />
        <span className="text-sm font-medium">Editar meu Perfil</span>
      </button>

      <button
        onClick={handleViewSubscription}
        className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          color: colors.textPrimary,
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bgTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <CreditCard className="w-5 h-5" style={{ color: colors.textSecondary }} />
        <span className="text-sm font-medium">Ver Minha Assinatura</span>
      </button>

      <div className="h-px" style={{ backgroundColor: colors.border, opacity: 0.5 }}></div>

      <button
        onClick={handleSignOut}
        className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
        style={{
          color: colors.textPrimary,
          backgroundColor: 'transparent'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.bgTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <LogOut className="w-5 h-5" style={{ color: colors.textSecondary }} />
        <span className="text-sm font-medium">Sair</span>
      </button>
    </div>
  );

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        onClick={handleClick}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none w-full"
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          firstName={firstName}
          lastName={lastName}
          size={size}
          isAdmin={isAdmin}
        />
        {showLabel && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
              {firstName} {lastName}
            </p>
            <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
              Meu perfil
            </p>
          </div>
        )}
      </button>

      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}
