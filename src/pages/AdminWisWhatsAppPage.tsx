import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';
import {
  MessageSquare,
  Save,
  Check,
  X,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowLeft,
  Power,
  MessageCircle,
  FileText,
  Link,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface WhatsAppConfig {
  id: string;
  is_enabled: boolean;
}

interface WhatsAppMessage {
  id: string;
  message_key: string;
  message_type: 'success' | 'error';
  message_text: string;
  send_via_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

interface WhatsAppLog {
  id: string;
  processo_id: string | null;
  user_id: string;
  phone_number: string;
  message_key: string;
  message_type: 'text' | 'document' | 'link';
  message_sent: string;
  zapi_response: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  user_profile?: { first_name: string; last_name: string; email: string };
}

const LOGS_PER_PAGE = 50;

interface AdminWisWhatsAppPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminWisWhatsAppPage({
  onNavigateToApp,
  onNavigateToMyProcess,
  onNavigateToChat,
  onNavigateToWorkspace,
  onNavigateToSchedule,
  onNavigateToAdmin,
  onNavigateToSettings,
  onNavigateToProfile,
  onNavigateToTerms,
  onNavigateToPrivacy,
  onNavigateToCookies,
}: AdminWisWhatsAppPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);

  const [editedMessages, setEditedMessages] = useState<Record<string, { text: string; enabled: boolean }>>({});
  const [selectedLog, setSelectedLog] = useState<WhatsAppLog | null>(null);

  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [messageTypeFilter, setMessageTypeFilter] = useState<'all' | 'text' | 'document' | 'link'>('all');
  const [lastLogRefresh, setLastLogRefresh] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, logFilter, messageTypeFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, [currentPage, logFilter, messageTypeFilter]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadConfig(), loadMessages(), loadLogs()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    const { data, error } = await supabase
      .from('wis_whatsapp_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setConfig(data);
    }
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from('wis_whatsapp_messages')
      .select('*')
      .order('message_type', { ascending: true })
      .order('message_key', { ascending: true });

    if (!error && data) {
      setMessages(data);
      const initialEdits: Record<string, { text: string; enabled: boolean }> = {};
      data.forEach((msg) => {
        initialEdits[msg.id] = { text: msg.message_text, enabled: msg.send_via_whatsapp };
      });
      setEditedMessages(initialEdits);
    }
  }

  async function loadLogs() {
    let query = supabase
      .from('wis_whatsapp_logs')
      .select('*', { count: 'exact' });

    if (logFilter === 'success') {
      query = query.eq('success', true);
    } else if (logFilter === 'error') {
      query = query.eq('success', false);
    }

    if (messageTypeFilter !== 'all') {
      query = query.eq('message_type', messageTypeFilter);
    }

    const from = (currentPage - 1) * LOGS_PER_PAGE;
    const to = from + LOGS_PER_PAGE - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Erro ao carregar logs:', error);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.filter(l => l.user_id).map(l => l.user_id))];

      let usersMap: Record<string, { first_name: string; last_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
        if (usersData) {
          usersMap = Object.fromEntries(usersData.map(u => [u.id, { first_name: u.first_name, last_name: u.last_name, email: u.email }]));
        }
      }

      const enrichedLogs = data.map(log => ({
        ...log,
        user_profile: log.user_id ? usersMap[log.user_id] : null,
      }));

      setLogs(enrichedLogs);
      setTotalLogs(count || 0);
      setLastLogRefresh(new Date());
    } else {
      setLogs(data || []);
      setTotalLogs(count || 0);
      setLastLogRefresh(new Date());
    }
  }

  async function toggleWhatsApp() {
    if (!config) return;

    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('wis_whatsapp_config')
        .update({ is_enabled: !config.is_enabled })
        .eq('id', config.id);

      if (!error) {
        setConfig({ ...config, is_enabled: !config.is_enabled });
      }
    } finally {
      setSavingConfig(false);
    }
  }

  async function saveMessages() {
    setSavingMessages(true);
    try {
      const updates = Object.entries(editedMessages).map(([id, values]) => ({
        id,
        message_text: values.text,
        send_via_whatsapp: values.enabled,
      }));

      for (const update of updates) {
        await supabase
          .from('wis_whatsapp_messages')
          .update({ message_text: update.message_text, send_via_whatsapp: update.send_via_whatsapp })
          .eq('id', update.id);
      }

      await loadMessages();
    } finally {
      setSavingMessages(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getMessageTypeIcon(type: string) {
    switch (type) {
      case 'text':
        return <MessageCircle className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'link':
        return <Link className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  }

  function getMessageTypeLabel(type: string) {
    switch (type) {
      case 'text':
        return 'Texto';
      case 'document':
        return 'Documento';
      case 'link':
        return 'Link';
      default:
        return type;
    }
  }

  const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);
  const successMessages = messages.filter(m => m.message_type === 'success');
  const errorMessages = messages.filter(m => m.message_type === 'error');

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
        onSearchClick={() => setIsSearchOpen(true)}
      />

      <main className={`flex-1 flex flex-col transition-all duration-300 pt-16 lg:pt-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/admin-wis-api');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar para Wis API</span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin" style={{ color: colors.textSecondary }} />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col items-center mb-6 sm:mb-8">
                <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                  <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.textSecondary }} />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                    Wis WhatsApp Connect
                  </h1>
                  <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                    Gerencie notificacoes WhatsApp para usuarios da API
                  </p>
                </div>
              </div>

                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Power className="w-5 h-5" style={{ color: colors.textSecondary }} />
                      <div>
                        <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
                          Status do Sistema
                        </h2>
                        <p className="text-xs" style={{ color: colors.textSecondary }}>
                          Ative ou desative notificacoes WhatsApp globalmente
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleWhatsApp}
                      disabled={savingConfig}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: config?.is_enabled ? '#22c55e' : '#ef4444',
                        color: '#ffffff',
                        opacity: savingConfig ? 0.7 : 1,
                      }}
                    >
                      {savingConfig ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : config?.is_enabled ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      {config?.is_enabled ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5" style={{ color: colors.textSecondary }} />
                      <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
                        Mensagens de Sucesso
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {successMessages.map((msg) => (
                      <div key={msg.id} className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
                            {msg.message_key}
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs" style={{ color: colors.textSecondary }}>WhatsApp</span>
                            <input
                              type="checkbox"
                              checked={editedMessages[msg.id]?.enabled ?? msg.send_via_whatsapp}
                              onChange={(e) => setEditedMessages({
                                ...editedMessages,
                                [msg.id]: { ...editedMessages[msg.id], enabled: e.target.checked }
                              })}
                              className="w-4 h-4 rounded"
                            />
                          </label>
                        </div>
                        <textarea
                          value={editedMessages[msg.id]?.text ?? msg.message_text}
                          onChange={(e) => setEditedMessages({
                            ...editedMessages,
                            [msg.id]: { ...editedMessages[msg.id], text: e.target.value }
                          })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                          style={{
                            backgroundColor: colors.bgSecondary,
                            color: colors.textPrimary,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" style={{ color: colors.textSecondary }} />
                      <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
                        Mensagens de Erro
                      </h2>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {errorMessages.map((msg) => (
                      <div key={msg.id} className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                            {msg.message_key}
                          </span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs" style={{ color: colors.textSecondary }}>WhatsApp</span>
                            <input
                              type="checkbox"
                              checked={editedMessages[msg.id]?.enabled ?? msg.send_via_whatsapp}
                              onChange={(e) => setEditedMessages({
                                ...editedMessages,
                                [msg.id]: { ...editedMessages[msg.id], enabled: e.target.checked }
                              })}
                              className="w-4 h-4 rounded"
                            />
                          </label>
                        </div>
                        <textarea
                          value={editedMessages[msg.id]?.text ?? msg.message_text}
                          onChange={(e) => setEditedMessages({
                            ...editedMessages,
                            [msg.id]: { ...editedMessages[msg.id], text: e.target.value }
                          })}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                          style={{
                            backgroundColor: colors.bgSecondary,
                            color: colors.textPrimary,
                            border: `1px solid ${colors.border}`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={saveMessages}
                      disabled={savingMessages}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                        color: colors.textPrimary,
                        opacity: savingMessages ? 0.7 : 1,
                      }}
                    >
                      {savingMessages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar Mensagens
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" style={{ color: colors.textSecondary }} />
                      <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
                        Logs de Mensagens ({totalLogs})
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={logFilter}
                        onChange={(e) => {
                          setLogFilter(e.target.value as 'all' | 'success' | 'error');
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{
                          backgroundColor: colors.bgPrimary,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <option value="all">Todos</option>
                        <option value="success">Sucesso</option>
                        <option value="error">Erro</option>
                      </select>
                      <select
                        value={messageTypeFilter}
                        onChange={(e) => {
                          setMessageTypeFilter(e.target.value as 'all' | 'text' | 'document' | 'link');
                          setCurrentPage(1);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs"
                        style={{
                          backgroundColor: colors.bgPrimary,
                          color: colors.textPrimary,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <option value="all">Todos Tipos</option>
                        <option value="text">Texto</option>
                        <option value="document">Documento</option>
                        <option value="link">Link</option>
                      </select>
                      {lastLogRefresh && (
                        <span className="text-xs" style={{ color: colors.textSecondary }}>
                          Atualizado: {lastLogRefresh.toLocaleTimeString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Data</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Usuario</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Telefone</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Tipo</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Chave</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Status</th>
                          <th className="text-left py-2 px-2" style={{ color: colors.textSecondary }}>Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center" style={{ color: colors.textSecondary }}>
                              Nenhum log encontrado
                            </td>
                          </tr>
                        ) : (
                          logs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                              <td className="py-2 px-2 text-xs" style={{ color: colors.textSecondary }}>
                                {formatDate(log.created_at)}
                              </td>
                              <td className="py-2 px-2" style={{ color: colors.textPrimary }}>
                                {log.user_profile ? `${log.user_profile.first_name} ${log.user_profile.last_name}` : '-'}
                              </td>
                              <td className="py-2 px-2 font-mono text-xs" style={{ color: colors.textSecondary }}>
                                {log.phone_number}
                              </td>
                              <td className="py-2 px-2">
                                <span className="flex items-center gap-1 text-xs" style={{ color: colors.textSecondary }}>
                                  {getMessageTypeIcon(log.message_type)}
                                  {getMessageTypeLabel(log.message_type)}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                                  {log.message_key}
                                </span>
                              </td>
                              <td className="py-2 px-2">
                                {log.success ? (
                                  <span className="flex items-center gap-1 text-xs" style={{ color: '#22c55e' }}>
                                    <CheckCircle className="w-3 h-3" /> Enviado
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs" style={{ color: '#ef4444' }}>
                                    <XCircle className="w-3 h-3" /> Erro
                                    {log.retry_count > 0 && ` (${log.retry_count}x)`}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => setSelectedLog(log)}
                                  className="p-1.5 rounded transition-colors hover:opacity-80"
                                  style={{ backgroundColor: colors.bgPrimary }}
                                >
                                  <Eye className="w-3.5 h-3.5" style={{ color: colors.textSecondary }} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: colors.bgPrimary }}
                      >
                        <ChevronLeft className="w-4 h-4" style={{ color: colors.textSecondary }} />
                      </button>
                      <span className="text-sm" style={{ color: colors.textSecondary }}>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: colors.bgPrimary }}
                      >
                        <ChevronRight className="w-4 h-4" style={{ color: colors.textSecondary }} />
                      </button>
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>
      </main>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>Detalhes do Log</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded hover:opacity-80">
                <X className="w-5 h-5" style={{ color: colors.textSecondary }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium" style={{ color: colors.textSecondary }}>Mensagem Enviada</label>
                <p className="mt-1 text-sm p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}>
                  {selectedLog.message_sent}
                </p>
              </div>
              {selectedLog.error_message && (
                <div>
                  <label className="text-xs font-medium" style={{ color: '#ef4444' }}>Erro</label>
                  <p className="mt-1 text-sm p-3 rounded-lg" style={{ backgroundColor: '#ef444410', color: '#ef4444' }}>
                    {selectedLog.error_message}
                  </p>
                </div>
              )}
              {selectedLog.zapi_response && (
                <div>
                  <label className="text-xs font-medium" style={{ color: colors.textSecondary }}>Resposta Z-API</label>
                  <pre className="mt-1 text-xs p-3 rounded-lg overflow-x-auto" style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}>
                    {JSON.stringify(selectedLog.zapi_response, null, 2)}
                  </pre>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-medium" style={{ color: colors.textSecondary }}>Processo ID</label>
                  <p className="font-mono text-xs" style={{ color: colors.textPrimary }}>{selectedLog.processo_id || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium" style={{ color: colors.textSecondary }}>Tentativas</label>
                  <p style={{ color: colors.textPrimary }}>{selectedLog.retry_count}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <IntelligentSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
