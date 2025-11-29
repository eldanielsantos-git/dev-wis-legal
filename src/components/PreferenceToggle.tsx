import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface PreferenceToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false
}: PreferenceToggleProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex-1 mr-4">
        <label
          className="text-sm font-medium block mb-1 cursor-pointer"
          style={{ color: colors.textPrimary }}
        >
          {label}
        </label>
        {description && (
          <p className="text-xs" style={{ color: colors.textSecondary }}>
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-green-500' : 'bg-gray-400'
        }`}
        style={{
          ...(checked
            ? { backgroundColor: '#10B981' }
            : { backgroundColor: theme === 'dark' ? '#6B7280' : '#9CA3AF' }),
          ...(disabled && { opacity: 0.5, cursor: 'not-allowed' })
        }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
