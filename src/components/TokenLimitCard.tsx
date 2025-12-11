import { Edit2, CheckCircle } from 'lucide-react';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface TokenLimitCardProps {
  config: TokenLimitConfig;
  onEdit: (config: TokenLimitConfig) => void;
}

export function TokenLimitCard({ config, onEdit }: TokenLimitCardProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const category = TokenLimitsService.getContextCategory(config.context_key);
  const icon = TokenLimitsService.getContextIcon(config.context_key);

  const categoryColor = category === 'analysis' ? '#3B82F6' : '#10B981';

  const cardBg = theme === 'dark' ? '#1A1A1A' : '#FFFFFF';
  const cardBorder = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
  const innerBg = theme === 'dark' ? '#141414' : '#F8F9FA';

  return (
    <div
      className="rounded-lg border-2 transition-all duration-200 hover:shadow-lg w-full"
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
    >
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0" role="img" aria-label={config.context_name}>
              {icon}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: colors.textPrimary }}>
                {config.context_name}
              </h3>
              {config.is_active && (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-500 font-medium">Ativo</span>
                </div>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-shrink-0"
            style={{
              backgroundColor: innerBg,
              borderColor: cardBorder
            }}
          >
            <div className="text-right">
              <p className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                Limite Atual
              </p>
              <p className="text-lg font-bold" style={{ color: colors.textPrimary }}>
                {config.max_output_tokens.toLocaleString()}
              </p>
            </div>
            <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>
              tokens
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="px-2.5 py-2 rounded-lg border text-center"
              style={{
                backgroundColor: innerBg,
                borderColor: cardBorder
              }}
            >
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.textSecondary }}>
                Mínimo
              </p>
              <p className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                {config.min_allowed.toLocaleString()}
              </p>
            </div>

            <div
              className="px-2.5 py-2 rounded-lg border text-center"
              style={{
                backgroundColor: innerBg,
                borderColor: cardBorder
              }}
            >
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.textSecondary }}>
                Máximo
              </p>
              <p className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                {config.max_allowed.toLocaleString()}
              </p>
            </div>
          </div>

          <button
            onClick={() => onEdit(config)}
            className="p-2 rounded-lg transition-colors hover:opacity-70 flex-shrink-0"
            style={{ color: colors.textSecondary }}
            title="Editar configuração"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
