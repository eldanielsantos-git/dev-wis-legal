import React, { useState, useEffect } from 'react';
import { Plus, Calendar as CalendarIcon, Filter, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ProcessCalendar } from '../components/ProcessCalendar';
import { CreateDeadlineModal } from '../components/CreateDeadlineModal';
import { EditDeadlineModal } from '../components/EditDeadlineModal';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { processDeadlinesService } from '../services/ProcessDeadlinesService';
import { ProcessosService } from '../services/ProcessosService';
import { ProcessDeadline, DeadlineStatus } from '../types/analysis';
import type { Processo } from '../lib/supabase';
import { useToast } from '../hooks/useToast';

export const SchedulePage: React.FC = () => {
  const { showToast } = useToast();
  const [deadlines, setDeadlines] = useState<ProcessDeadline[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDeadline, setSelectedDeadline] = useState<ProcessDeadline | null>(null);
  const [filterStatus, setFilterStatus] = useState<DeadlineStatus | 'all'>('all');
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
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Agenda de Processos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie prazos e compromissos dos seus processos
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Concluídos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Vencidos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.expired}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Hoje</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.today}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Esta Semana</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisWeek}</p>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedDate ? formatDate(selectedDate.toISOString().split('T')[0]) : 'Selecione uma data'}
                </h3>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Adicionar prazo"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as DeadlineStatus | 'all')}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendentes</option>
                  <option value="completed">Concluídos</option>
                  <option value="expired">Vencidos</option>
                </select>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {selectedDateDeadlines.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum prazo para esta data</p>
                  </div>
                ) : (
                  selectedDateDeadlines.map(deadline => (
                    <div
                      key={deadline.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleEditDeadline(deadline)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                            {deadline.subject}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {getProcessoTitle(deadline.processo_id)}
                          </p>
                        </div>
                        <DeadlineBadge status={deadline.status} size="sm" />
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {deadline.deadline_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(deadline.deadline_time)}
                          </div>
                        )}
                        {deadline.category && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {deadline.category}
                          </span>
                        )}
                      </div>

                      {deadline.notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {deadline.notes}
                        </p>
                      )}

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(deadline);
                          }}
                          className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
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
