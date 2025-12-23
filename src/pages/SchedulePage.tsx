import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Calendar as CalendarIcon, Filter, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { ProcessCalendar } from '../components/ProcessCalendar';
import { CreateDeadlineModal } from '../components/CreateDeadlineModal';
import { EditDeadlineModal } from '../components/EditDeadlineModal';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { processDeadlinesService } from '../services/ProcessDeadlinesService';
import { ProcessosService } from '../services/ProcessosService';
import { ProcessDeadline, DeadlineStatus } from '../types/analysis';
import type { Processo } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';

interface SchedulePageProps {
  onNavigateToAdmin?: () => void;
  onNavigateToApp?: () => void;
  onNavigateToMyProcess?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToProfile?: () => void;
}

export const SchedulePage: React.FC<SchedulePageProps> = ({
  onNavigateToAdmin,
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToProfile
}) => {
  const { isAdmin } = useAuth();
  const { theme } = useTheme();
  const colors = useMemo(() => getThemeColors(theme), [theme]);
  const { showToast } = useToast();
  const [deadlines, setDeadlines] = useState<ProcessDeadline[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<ProcessDeadline | null>(null);
  const [filterStatus, setFilterStatus] = useState<DeadlineStatus | 'all'>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    expired: 0,
    today: 0,
    thisWeek: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [deadlinesData, processosData, statsData] = await Promise.all([
        processDeadlinesService.getDeadlines(),
        ProcessosService.getAllProcessos(),
        processDeadlinesService.getDeadlineStats()
      ]);

      setDeadlines(deadlinesData);
      setProcessos(processosData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading schedule data:', error);
      showToast('Erro ao carregar agenda', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedDateDeadlines = (): ProcessDeadline[] => {
    if (!selectedDate) return [];
    const dateStr = selectedDate.toISOString().split('T')[0];
    let filtered = deadlines.filter(d => d.deadline_date === dateStr);

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    return filtered.sort((a, b) => {
      if (a.deadline_time && b.deadline_time) {
        return a.deadline_time.localeCompare(b.deadline_time);
      }
      if (a.deadline_time) return -1;
      if (b.deadline_time) return 1;
      return 0;
    });
  };

  const getProcessoTitle = (processoId: string): string => {
    const processo = processos.find(p => p.id === processoId);
    return processo?.titulo || 'Processo sem título';
  };

  const handleEditDeadline = (deadline: ProcessDeadline) => {
    setSelectedDeadline(deadline);
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async (deadline: ProcessDeadline) => {
    try {
      if (deadline.status === 'completed') {
        await processDeadlinesService.markAsPending(deadline.id);
        showToast('Prazo marcado como pendente', 'success');
      } else {
        await processDeadlinesService.markAsCompleted(deadline.id);
        showToast('Prazo marcado como concluído', 'success');
      }
      loadData();
    } catch (error) {
      console.error('Error toggling deadline status:', error);
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr?: string): string => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  const selectedDateDeadlines = getSelectedDateDeadlines();

  if (isLoading) {
    return (
      <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
        <SidebarWis
          onNavigateToApp={onNavigateToApp}
          onNavigateToMyProcess={onNavigateToMyProcess}
          onNavigateToChat={onNavigateToChat}
          onNavigateToWorkspace={onNavigateToWorkspace}
          onNavigateToSchedule={() => {}}
          onNavigateToAdmin={onNavigateToAdmin}
          onNavigateToProfile={onNavigateToProfile}
          onNavigateToSettings={() => {
            window.history.pushState({}, '', '/admin-settings');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onNavigateToNotifications={() => {
            window.history.pushState({}, '', '/notifications');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onNavigateToTokens={() => {
            window.history.pushState({}, '', '/tokens');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onNavigateToSubscription={() => {
            window.history.pushState({}, '', '/signature');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          onCollapsedChange={setIsSidebarCollapsed}
          activePage="schedule"
        />
        <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
          <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.accent }}></div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-body" style={{ backgroundColor: colors.bgPrimary }}>
      <SidebarWis
        onNavigateToApp={onNavigateToApp}
        onNavigateToMyProcess={onNavigateToMyProcess}
        onNavigateToChat={onNavigateToChat}
        onNavigateToWorkspace={onNavigateToWorkspace}
        onNavigateToSchedule={() => {}}
        onNavigateToAdmin={onNavigateToAdmin}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToSettings={() => {
          window.history.pushState({}, '', '/admin-settings');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToNotifications={() => {
          window.history.pushState({}, '', '/notifications');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToTokens={() => {
          window.history.pushState({}, '', '/tokens');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onNavigateToSubscription={() => {
          window.history.pushState({}, '', '/signature');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
        onCollapsedChange={setIsSidebarCollapsed}
        activePage="schedule"
      />
      <div className={`${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16 lg:pt-0 flex-1 flex flex-col transition-[margin-left] duration-300 ease-in-out`}>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          <div className="mb-8 sm:mb-10 lg:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-title font-normal mb-3 sm:mb-4" style={{ color: colors.textPrimary }}>
              Agenda de Processos
            </h1>
            <p className="text-base sm:text-lg" style={{ color: colors.textSecondary }}>
              Gerencie prazos e compromissos dos seus processos
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="rounded-xl shadow-sm p-4 transition-all" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5" style={{ color: colors.accent }} />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Pendentes</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.pending}</p>
            </div>

            <div className="rounded-xl shadow-sm p-4 transition-all" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Concluídos</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.completed}</p>
            </div>

            <div className="rounded-xl shadow-sm p-4 transition-all" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Vencidos</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.expired}</p>
            </div>

            <div className="rounded-xl shadow-sm p-4 transition-all" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-5 h-5" style={{ color: colors.accent }} />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Hoje</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.today}</p>
            </div>

            <div className="rounded-xl shadow-sm p-4 transition-all" style={{ backgroundColor: colors.bgSecondary }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-sm" style={{ color: colors.textSecondary }}>Esta Semana</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{stats.thisWeek}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ProcessCalendar
                deadlines={deadlines}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </div>

            <div className="space-y-4">
              <div className="rounded-xl shadow-lg p-6" style={{ backgroundColor: colors.bgSecondary }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                    {selectedDate ? formatDate(selectedDate.toISOString().split('T')[0]) : 'Selecione uma data'}
                  </h3>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="p-2 text-white rounded-lg hover:opacity-80 transition-all"
                    style={{ backgroundColor: colors.accent }}
                    title="Adicionar prazo"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as DeadlineStatus | 'all')}
                    className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 transition-all"
                    style={{
                      backgroundColor: colors.bgPrimary,
                      color: colors.textPrimary,
                      borderColor: colors.border
                    }}
                  >
                    <option value="all">Todos os Status</option>
                    <option value="pending">Pendentes</option>
                    <option value="completed">Concluídos</option>
                    <option value="expired">Vencidos</option>
                  </select>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {selectedDateDeadlines.length === 0 ? (
                    <div className="text-center py-8" style={{ color: colors.textSecondary }}>
                      <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum prazo para esta data</p>
                    </div>
                  ) : (
                    selectedDateDeadlines.map(deadline => (
                      <div
                        key={deadline.id}
                        className="rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                        style={{ backgroundColor: colors.bgPrimary }}
                        onClick={() => handleEditDeadline(deadline)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium mb-1" style={{ color: colors.textPrimary }}>
                              {deadline.subject}
                            </h4>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              {getProcessoTitle(deadline.processo_id)}
                            </p>
                          </div>
                          <DeadlineBadge status={deadline.status} size="sm" />
                        </div>

                        <div className="flex items-center gap-4 text-sm" style={{ color: colors.textSecondary }}>
                          {deadline.deadline_time && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatTime(deadline.deadline_time)}
                            </div>
                          )}
                          {deadline.category && (
                            <span className="px-2 py-0.5 rounded text-xs" style={{
                              backgroundColor: `${colors.accent}20`,
                              color: colors.accent
                            }}>
                              {deadline.category}
                            </span>
                          )}
                        </div>

                        {deadline.notes && (
                          <p className="mt-2 text-sm line-clamp-2" style={{ color: colors.textSecondary }}>
                            {deadline.notes}
                          </p>
                        )}

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(deadline);
                            }}
                            className="text-xs px-3 py-1 rounded hover:opacity-80 transition-all"
                            style={{
                              backgroundColor: colors.bgSecondary,
                              color: colors.textPrimary
                            }}
                          >
                            {deadline.status === 'completed' ? 'Marcar como Pendente' : 'Marcar como Concluído'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
        <FooterWis />
      </div>

      <CreateDeadlineModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDeadlineCreated={loadData}
        prefilledDate={selectedDate?.toISOString().split('T')[0]}
      />

      <EditDeadlineModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedDeadline(null);
        }}
        deadline={selectedDeadline}
        onDeadlineUpdated={loadData}
        onDeadlineDeleted={loadData}
      />
    </div>
  );
};
