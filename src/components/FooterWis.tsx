import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface FooterWisProps {
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function FooterWis({ onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: FooterWisProps = {}) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const handleNavigate = (callback?: () => void) => {
    if (callback) {
      callback();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="py-6 mt-auto font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2">
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            Copyright © 2025 Todos os direitos reservados
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs" style={{ color: colors.textSecondary }}>
            <a
              href="http://wislegal.io/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary}
            >
              Termos de Uso
            </a>
            <span>|</span>
            <a
              href="http://wislegal.io/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary}
            >
              Política de Privacidade
            </a>
            <span>|</span>
            <a
              href="http://wislegal.io/cookies"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors"
              style={{ color: colors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary}
            >
              Uso de Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
