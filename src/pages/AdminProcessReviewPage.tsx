import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { getThemeColors } from '../utils/themeUtils';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import {
  RefreshCcw,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  Play,
  ArrowLeft,
  Filter,
  Search,
  History
} from 'lucide-react';
import { ProcessDiagnosticService } from '../services/ProcessDiagnosticService';
import { ProcessUnlockService } from '../services/ProcessUnlockService';
import { ProcessUnlockAuditService, AuditRecord } from '../services/ProcessUnlockAuditService';
import {
  UNLOCK_CONFIG,
  STUCK_STATUS_THRESHOLDS,
  StuckProcessInfo,
  PromptStatus,
  SimulationResult
} from '../config/unlockConfig';
import { UnlockConfirmationModal } from '../components/UnlockConfirmationModal';

interface AdminProcessReviewPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat: () => void;
  onNavigateToWorkspace: () => void;
  onNavigateToSchedule: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings: () => void;
  onNavigateToProfile: () => void;
  onNavigateToNotifications: () => void;
  onNavigateToTokens: () => void;
  onNavigateToSubscription: () => void;
  onNavigateToTerms: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToCookies: () => void;
}

type TimeFilter = 'all' | '15-30' | '30-60' | '60+';
type ViewMode = 'stuck' | 'audit';

export function AdminProcessReviewPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToNotifications,
  onNavigateToTokens,
  onNavigateToSubscription,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies
}: AdminProcessReviewPageProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const colors = getThemeColors(theme);

  const [stuckProcesses, setStuckProcesses] = useState<StuckProcessInfo[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<string>>(new Set());
  const [expandedProcess, setExpandedProcess] = useState<string | null>(null);
  const [promptDetails, setPromptDetails] = useState<Map<string, PromptStatus[]>>(new Map());
  const [simulationResults, setSimulationResults] = useState<Map<string, SimulationResult>>(new Map());

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showOnlyEligible, setShowOnlyEligible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('stuck');

  const [unlockReason, setUnlockReason] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [rateLimit, setRateLimit] = useState({ allowed: true, remaining: 10, resetIn: 0 });
  const [cooldown, setCooldown] = useState(0);

  const loadStuckProcesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const processes = await ProcessDiagnosticService.getStuckProcesses();
      setStuckProcesses(processes);
    } catch (error) {
      console.error('Error loading stuck processes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAuditRecords = useCallback(async () => {
    try {
      const records = await ProcessUnlockAuditService.getAllAuditRecords();
      setAuditRecords(records);
    } catch (error) {
      console.error('Error loading audit records:', error);
    }
  }, []);

  const updateRateLimitInfo = useCallback(() => {
    setRateLimit(ProcessUnlockService.canPerformUnlock());
    setCooldown(ProcessUnlockService.getCooldownRemaining());
  }, []);

  useEffect(() => {
    loadStuckProcesses();
    loadAuditRecords();
    updateRateLimitInfo();

    const interval = setInterval(() => {
      loadStuckProcesses();
      updateRateLimitInfo();
    }, UNLOCK_CONFIG.POLLING_INTERVAL_MS);

    const cooldownInterval = setInterval(() => {
      setCooldown(ProcessUnlockService.getCooldownRemaining());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(cooldownInterval);
    };
  }, [loadStuckProcesses, loadAuditRecords, updateRateLimitInfo]);

  const handleExpandProcess = async (processoId: string) => {
    if (expandedProcess === processoId) {
      setExpandedProcess(null);
      return;
    }

    setExpandedProcess(processoId);
    if (!promptDetails.has(processoId)) {
      const details = await ProcessDiagnosticService.getStuckPromptDetails(processoId);
      setPromptDetails(prev => new Map(prev).set(processoId, details));
    }
  };

  const handleSelectProcess = (processoId: string) => {
    const newSelection = new Set(selectedProcesses);
    if (newSelection.has(processoId)) {
      newSelection.delete(processoId);
    } else {
      newSelection.add(processoId);
    }
    setSelectedProcesses(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedProcesses.size === filteredProcesses.length) {
      setSelectedProcesses(new Set());
    } else {
      setSelectedProcesses(new Set(filteredProcesses.map(p => p.processoId)));
    }
  };

  const handleSimulate = async () => {
    if (selectedProcesses.size === 0) return;

    setIsSimulating(true);
    const results = new Map<string, SimulationResult>();

    for (const processoId of selectedProcesses) {
      try {
        const result = await ProcessDiagnosticService.validateUnlockEligibility(processoId);
        const simulation = await ProcessUnlockService.simulateUnlock(processoId);
        results.set(processoId, simulation);
      } catch (error) {
        console.error(`Error simulating unlock for ${processoId}:`, error);
      }
    }

    setSimulationResults(results);
    setIsSimulating(false);
  };

  const handleConfirmUnlock = async () => {
    if (!user || selectedProcesses.size === 0) return;

    setIsUnlocking(true);
    try {
      const result = await ProcessUnlockService.unlockMultipleProcesses(
        Array.from(selectedProcesses),
        user.id,
        user.email || 'unknown',
        unlockReason
      );

      if (result.success.length > 0) {
        setSelectedProcesses(new Set());
        setSimulationResults(new Map());
        setUnlockReason('');
        await loadStuckProcesses();
        await loadAuditRecords();
      }

      updateRateLimitInfo();
    } catch (error) {
      console.error('Error unlocking processes:', error);
    } finally {
      setIsUnlocking(false);
      setShowConfirmModal(false);
    }
  };

  const filteredProcesses = stuckProcesses.filter(p => {
    if (showOnlyEligible && !p.isEligibleForUnlock) return false;

    if (timeFilter !== 'all') {
      if (timeFilter === '15-30' && (p.minutesStuck < 15 || p.minutesStuck >= 30)) return false;
      if (timeFilter === '30-60' && (p.minutesStuck < 30 || p.minutesStuck >= 60)) return false;
      if (timeFilter === '60+' && p.minutesStuck < 60) return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.processoNumero.toLowerCase().includes(query) ||
        p.userEmail.toLowerCase().includes(query) ||
        p.stuckAtPromptTitle.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const stats = {
    total: stuckProcesses.length,
    eligible: stuckProcesses.filter(p => p.isEligibleForUnlock).length,
    avgMinutes: stuckProcesses.length > 0
      ? Math.round(stuckProcesses.reduce((sum, p) => sum + p.minutesStuck, 0) / stuckProcesses.length)
      : 0,
    totalPages: stuckProcesses.reduce((sum, p) => sum + p.totalPages, 0)
  };

  const getStatusColor = (minutes: number) => {
    if (minutes < STUCK_STATUS_THRESHOLDS.HEALTHY) return '#10B981';
    if (minutes < STUCK_STATUS_THRESHOLDS.WARNING) return '#F59E0B';
    return '#EF4444';
  };

  const getPromptStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'processing': return '#F59E0B';
      case 'pending': return '#6B7280';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={onNavigateToSchedule}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToTokens={onNavigateToTokens}
        onNavigateToSubscription={onNavigateToSubscription}
      />
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={onNavigateToSettings}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: colors.textSecondary }} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#F59E0B20' }}>
                    <RefreshCcw className="w-6 h-6" style={{ color: '#F59E0B' }} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold" style={{ color: colors.textPrimary }}>
                      Revisao de Processos
                    </h1>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      Diagnostique e destraque processos com problemas
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={loadStuckProcesses}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: colors.bgSecondary, color: colors.textPrimary }}
              >
                <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#EF444420' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: '#EF4444' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.total}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Total Travados</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#10B98120' }}>
              <Check className="w-5 h-5" style={{ color: '#10B981' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.eligible}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Elegiveis</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#F59E0B20' }}>
              <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.avgMinutes}m</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Tempo Medio</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#3B82F620' }}>
              <FileText className="w-5 h-5" style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.totalPages}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Paginas Afetadas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewMode('stuck')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'stuck' ? 'bg-blue-600 text-white' : ''
          }`}
          style={viewMode !== 'stuck' ? { backgroundColor: colors.bgSecondary, color: colors.textPrimary } : {}}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Processos Travados
        </button>
        <button
          onClick={() => { setViewMode('audit'); loadAuditRecords(); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'audit' ? 'bg-blue-600 text-white' : ''
          }`}
          style={viewMode !== 'audit' ? { backgroundColor: colors.bgSecondary, color: colors.textPrimary } : {}}
        >
          <History className="w-4 h-4 inline mr-2" />
          Historico de Auditorias
        </button>
      </div>

      {viewMode === 'stuck' && (
        <>
          <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" style={{ color: colors.textSecondary }} />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Filtros:</span>
              </div>

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="px-3 py-1.5 rounded-lg text-sm border-0"
                style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', color: colors.textPrimary }}
              >
                <option value="all">Todos os tempos</option>
                <option value="15-30">15-30 min</option>
                <option value="30-60">30-60 min</option>
                <option value="60+">60+ min</option>
              </select>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyEligible}
                  onChange={(e) => setShowOnlyEligible(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm" style={{ color: colors.textPrimary }}>Apenas elegiveis</span>
              </label>

              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.textSecondary }} />
                  <input
                    type="text"
                    placeholder="Buscar por nome, email ou etapa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm border-0"
                    style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', color: colors.textPrimary }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="p-4 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProcesses.size === filteredProcesses.length && filteredProcesses.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                      Selecionar todos ({filteredProcesses.length})
                    </span>
                  </label>
                </div>
                {selectedProcesses.size > 0 && (
                  <span className="text-sm px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    {selectedProcesses.size} selecionado(s)
                  </span>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
              </div>
            ) : filteredProcesses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Check className="w-12 h-12 mb-3" style={{ color: '#10B981' }} />
                <p className="text-lg font-medium" style={{ color: colors.textPrimary }}>
                  Nenhum processo travado
                </p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  Todos os processos estao funcionando normalmente
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                {filteredProcesses.map(process => (
                  <div key={process.processoId}>
                    <div className="p-4 flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedProcesses.has(process.processoId)}
                        onChange={() => handleSelectProcess(process.processoId)}
                        disabled={!process.isEligibleForUnlock}
                        className="w-4 h-4 rounded"
                      />

                      <button
                        onClick={() => handleExpandProcess(process.processoId)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {expandedProcess === process.processoId ? (
                          <ChevronUp className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        ) : (
                          <ChevronDown className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate" style={{ color: colors.textPrimary }}>
                            {process.processoNumero}
                          </p>
                          {process.isEligibleForUnlock ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              Destravavel
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Complexo
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                          {process.userEmail}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                          {process.totalPages}
                        </p>
                        <p className="text-xs" style={{ color: colors.textSecondary }}>paginas</p>
                      </div>

                      <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                          Etapa {process.stuckAtPromptOrder}
                        </p>
                        <p className="text-xs truncate max-w-[150px]" style={{ color: colors.textSecondary }}>
                          {process.stuckAtPromptTitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getStatusColor(process.minutesStuck) }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: getStatusColor(process.minutesStuck) }}
                        >
                          {process.minutesStuck}m
                        </span>
                      </div>
                    </div>

                    {expandedProcess === process.processoId && (
                      <div className="px-4 pb-4 pt-2 ml-12" style={{ backgroundColor: theme === 'dark' ? '#1a1c23' : '#F9FAFB' }}>
                        <div className="rounded-lg p-4" style={{ backgroundColor: colors.bgSecondary }}>
                          <h4 className="text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
                            Status das 9 Etapas
                          </h4>
                          <div className="flex items-center gap-1 mb-4">
                            {Array.from({ length: UNLOCK_CONFIG.TOTAL_PROMPTS }, (_, i) => {
                              const detail = promptDetails.get(process.processoId)?.find(p => p.promptOrder === i + 1);
                              const status = detail?.status || 'pending';
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                      status === 'processing' ? 'animate-pulse' : ''
                                    }`}
                                    style={{
                                      backgroundColor: getPromptStatusColor(status) + '20',
                                      color: getPromptStatusColor(status)
                                    }}
                                    title={detail?.promptTitle || `Etapa ${i + 1}`}
                                  >
                                    {i + 1}
                                  </div>
                                  {i < UNLOCK_CONFIG.TOTAL_PROMPTS - 1 && (
                                    <div
                                      className="w-full h-0.5 mt-4"
                                      style={{ backgroundColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span style={{ color: colors.textSecondary }}>Worker ID:</span>
                              <span className="ml-2 font-mono" style={{ color: colors.textPrimary }}>
                                {process.workerId || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: colors.textSecondary }}>Modelo:</span>
                              <span className="ml-2" style={{ color: colors.textPrimary }}>
                                {process.currentModelName || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: colors.textSecondary }}>Ultima Atividade:</span>
                              <span className="ml-2" style={{ color: colors.textPrimary }}>
                                {process.lastActivity ? new Date(process.lastActivity).toLocaleString('pt-BR') : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: colors.bgSecondary }}>
            <h3 className="text-lg font-medium mb-4" style={{ color: colors.textPrimary }}>
              Painel de Acoes
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                  Motivo do destravamento (obrigatorio)
                </label>
                <textarea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Descreva o motivo do destravamento..."
                  className="w-full px-3 py-2 rounded-lg border-0 resize-none"
                  style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6', color: colors.textPrimary }}
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={handleSimulate}
                  disabled={selectedProcesses.size === 0 || isSimulating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSimulating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Simular Destravamento
                </button>

                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={
                    selectedProcesses.size === 0 ||
                    simulationResults.size === 0 ||
                    !unlockReason.trim() ||
                    !rateLimit.allowed ||
                    cooldown > 0
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Destravar Selecionados
                </button>

                <div className="flex-1" />

                <div className="flex items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                  <span>
                    {rateLimit.remaining}/{UNLOCK_CONFIG.RATE_LIMIT_MAX} restantes
                  </span>
                  {cooldown > 0 && (
                    <span className="text-amber-500">
                      Aguarde {cooldown}s
                    </span>
                  )}
                </div>
              </div>

              {simulationResults.size > 0 && (
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#1a1c23' : '#F9FAFB' }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                    Resultado da Simulacao
                  </h4>
                  <div className="space-y-2">
                    {Array.from(simulationResults.entries()).map(([id, result]) => (
                      <div key={id} className="flex items-center gap-2 text-sm">
                        {result.wouldSucceed ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                        <span style={{ color: colors.textPrimary }}>
                          {stuckProcesses.find(p => p.processoId === id)?.processoNumero}:
                        </span>
                        <span style={{ color: result.wouldSucceed ? '#10B981' : '#EF4444' }}>
                          {result.wouldSucceed ? 'Pronto para destravar' : result.eligibility.reasons.join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'audit' && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="p-4 border-b" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
            <h3 className="text-lg font-medium" style={{ color: colors.textPrimary }}>
              Historico de Auditorias ({auditRecords.length})
            </h3>
          </div>

          {auditRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History className="w-12 h-12 mb-3" style={{ color: colors.textSecondary }} />
              <p className="text-lg font-medium" style={{ color: colors.textPrimary }}>
                Nenhum registro de auditoria
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: theme === 'dark' ? '#1a1c23' : '#F9FAFB' }}>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Data/Hora</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Admin</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Processo</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Acao</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Paginas</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Tempo Travado</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ color: colors.textSecondary }}>Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#E5E7EB' }}>
                  {auditRecords.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                        {new Date(record.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                        {record.userEmail}
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                        {record.processoNumero}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          record.actionType === 'unlock'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {record.actionType === 'unlock' ? 'Destravamento' : 'Simulacao'}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                        {record.totalPages}
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.textPrimary }}>
                        {record.durationMinutesStuck}m
                      </td>
                      <td className="px-4 py-3">
                        {record.success ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="w-4 h-4" /> Sucesso
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <X className="w-4 h-4" /> Falha
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <UnlockConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmUnlock}
        selectedProcesses={filteredProcesses.filter(p => selectedProcesses.has(p.processoId))}
        simulationResults={simulationResults}
        reason={unlockReason}
        isLoading={isUnlocking}
      />
          </div>
        </main>
        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </div>
    </div>
  );
}
