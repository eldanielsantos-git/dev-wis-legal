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
      className="rounded-lg border-2 transition-all duration-200 hover:shadow-lg"
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
    >
      <div
        className="h-1.5 rounded-t-lg"
        style={{ backgroundColor: categoryColor }}
      />

      <div className="p-3">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xl" role="img" aria-label={config.context_name}>
              {icon}
            </span>
            <h3 className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
              {config.context_name}
            </h3>
          </div>

          <button
            onClick={() => onEdit(config)}
            className="p-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: colors.textSecondary }}
            title="Editar configuração"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <div
            className="flex items-baseline justify-between p-2.5 rounded-lg border"
            style={{
              backgroundColor: innerBg,
              borderColor: cardBorder
            }}
          >
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: colors.textSecondary }}>
                Limite Atual
              </p>
              <p className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                {config.max_output_tokens.toLocaleString()}
              </p>
            </div>
            <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>
              tokens
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div
              className="p-1.5 rounded-lg border"
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
              className="p-1.5 rounded-lg border"
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

          <div className="flex items-center gap-1.5 pt-0.5">
            {config.is_active && (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Ativo</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
