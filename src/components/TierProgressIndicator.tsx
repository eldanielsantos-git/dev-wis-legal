import { TierSystemService, TierName } from '../services/TierSystemService';
import { Clock, Zap, CheckCircle, Layers } from 'lucide-react';

interface TierProgressIndicatorProps {
  tierName: TierName;
  totalPages: number;
  showDetails?: boolean;
  className?: string;
}

export default function TierProgressIndicator({
  tierName,
  totalPages,
  showDetails = true,
  className = '',
}: TierProgressIndicatorProps) {
  const tierColor = TierSystemService.getTierColor(tierName);
  const tierIcon = TierSystemService.getTierIcon(tierName);
  const tierLabel = TierSystemService.getTierLabel(tierName);
  const stats = TierSystemService.getTierStats(tierName);
  const estimatedTime = TierSystemService.formatEstimatedTime(totalPages);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border shadow-sm ${className}`} style={{ borderColor: tierColor }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{tierIcon}</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Tier: {tierLabel}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {totalPages.toLocaleString('pt-BR')} páginas
              </p>
            </div>
          </div>
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: tierColor }}
          >
            {tierName}
          </div>
        </div>

        {showDetails && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tempo Estimado</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{estimatedTime}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Workers Paralelos</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{stats.maxParallelWorkers}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Checkpoints</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.hasCheckpoints ? 'Sim' : 'Não'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Layers className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Consolidação</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.hasHierarchy ? 'Hierárquica' : 'Simples'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
