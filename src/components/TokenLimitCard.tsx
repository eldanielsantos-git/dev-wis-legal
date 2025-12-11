import { Edit2, AlertTriangle, CheckCircle } from 'lucide-react';
import { TokenLimitConfig, TokenLimitsService } from '../services/TokenLimitsService';
import { useTheme } from '../contexts/ThemeContext';

interface TokenLimitCardProps {
  config: TokenLimitConfig;
  onEdit: (config: TokenLimitConfig) => void;
}

export function TokenLimitCard({ config, onEdit }: TokenLimitCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const category = TokenLimitsService.getContextCategory(config.context_key);
  const icon = TokenLimitsService.getContextIcon(config.context_key);

  const isNearMax = config.max_output_tokens > config.max_allowed * 0.8;
  const isNearMin = config.max_output_tokens < config.min_allowed * 1.2;

  const categoryColor = category === 'analysis'
    ? 'from-blue-500 to-blue-600'
    : 'from-green-500 to-green-600';

  const categoryColorDark = category === 'analysis'
    ? 'from-blue-600 to-blue-700'
    : 'from-green-600 to-green-700';

  return (
    <div
      className={`rounded-xl border ${
        isDark
          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-gray-300'
      } transition-all duration-200 hover:shadow-lg`}
    >
      <div
        className={`h-2 rounded-t-xl bg-gradient-to-r ${
          isDark ? categoryColorDark : categoryColor
        }`}
      />

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <span className="text-3xl" role="img" aria-label={config.context_name}>
              {icon}
            </span>
            <div className="flex-1">
              <h3
                className={`text-lg font-semibold mb-1 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {config.context_name}
              </h3>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {config.context_description}
              </p>
            </div>
          </div>

          <button
            onClick={() => onEdit(config)}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title="Editar configuração"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div
            className={`flex items-baseline justify-between p-4 rounded-lg ${
              isDark ? 'bg-gray-700/50' : 'bg-gray-50'
            }`}
          >
            <div>
              <p
                className={`text-sm font-medium mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Limite Atual
              </p>
              <p
                className={`text-3xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {config.max_output_tokens.toLocaleString()}
              </p>
            </div>
            <span
              className={`text-sm font-medium ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              tokens
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className={`p-3 rounded-lg ${
                isDark ? 'bg-gray-700/30' : 'bg-gray-50/50'
              }`}
            >
              <p
                className={`text-xs font-medium mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Mínimo
              </p>
              <p
                className={`text-sm font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {config.min_allowed.toLocaleString()}
              </p>
            </div>

            <div
              className={`p-3 rounded-lg ${
                isDark ? 'bg-gray-700/30' : 'bg-gray-50/50'
              }`}
            >
              <p
                className={`text-xs font-medium mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Máximo
              </p>
              <p
                className={`text-sm font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {config.max_allowed.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {config.is_active ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-500 font-medium">Ativo</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-yellow-500 font-medium">Inativo</span>
              </>
            )}

            {isNearMax && (
              <div className="flex items-center gap-1 ml-auto">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-orange-500">Próximo ao máximo</span>
              </div>
            )}

            {isNearMin && (
              <div className="flex items-center gap-1 ml-auto">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-yellow-500">Valor baixo</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
