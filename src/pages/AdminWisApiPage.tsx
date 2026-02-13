import React, { useState, useEffect } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { supabase } from '../lib/supabase';
import {
  MessageSquare,
  Plus,
  Trash2,
  Save,
  Check,
  X,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertCircle,
  FileText,
  Edit3,
  ArrowLeft,
  BookText,
} from 'lucide-react';

interface Partner {
  id: string;
  partner_name: string;
  api_url_pattern: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ErrorMessage {
  id: string;
  error_key: string;
  message_text: string;
  created_at: string;
  updated_at: string;
}

interface ApiLog {
  id: string;
  partner_id: string | null;
  phone_number: string;
  user_id: string | null;
  success: boolean;
  error_key: string | null;
  request_payload: Record<string, unknown>;
  response_sent: Record<string, unknown>;
  created_at: string;
  partner?: Partner;
  user_profile?: { first_name: string; last_name: string; email: string };
}

const LOGS_PER_PAGE = 50;

interface AdminWisApiPageProps {
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

export function AdminWisApiPage({
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
}: AdminWisApiPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [partners, setPartners] = useState<Partner[]>([]);
  const [errorMessages, setErrorMessages] = useState<ErrorMessage[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [savingPartner, setSavingPartner] = useState(false);
  const [savingMessages, setSavingMessages] = useState(false);

  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerUrl, setNewPartnerUrl] = useState('');

  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editPartnerUrl, setEditPartnerUrl] = useState('');
  const [editPartnerActive, setEditPartnerActive] = useState(true);
  const [updatingPartner, setUpdatingPartner] = useState(false);

  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [currentPage, logFilter, partnerFilter]);

  async function loadData() {
    setLoading(true);
    try {
      await Promise.all([loadPartners(), loadErrorMessages(), loadLogs()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPartners() {
    const { data, error } = await supabase
      .from('wis_api_partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPartners(data);
    }
  }

  async function loadErrorMessages() {
    const { data, error } = await supabase
      .from('wis_api_error_messages')
      .select('*')
      .order('error_key', { ascending: true });

    if (!error && data) {
      setErrorMessages(data);
      const initialEdits: Record<string, string> = {};
      data.forEach((msg) => {
        initialEdits[msg.id] = msg.message_text;
      });
      setEditedMessages(initialEdits);
    }
  }

  async function loadLogs() {
    let query = supabase
      .from('wis_api_logs')
      .select('*, partner:wis_api_partners(partner_name), user_profile:user_profiles(first_name, last_name, email)', { count: 'exact' });

    if (logFilter === 'success') {
      query = query.eq('success', true);
    } else if (logFilter === 'error') {
      query = query.eq('success', false);
    }

    if (partnerFilter !== 'all') {
      query = query.eq('partner_id', partnerFilter);
    }

    const from = (currentPage - 1) * LOGS_PER_PAGE;
    const to = from + LOGS_PER_PAGE - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setLogs(data);
      setTotalLogs(count || 0);
    }
  }

  async function addPartner() {
    if (!newPartnerName.trim() || !newPartnerUrl.trim()) return;

    setSavingPartner(true);
    try {
      const { error } = await supabase.from('wis_api_partners').insert({
        partner_name: newPartnerName.trim(),
        api_url_pattern: newPartnerUrl.trim(),
        is_active: true,
      });

      if (!error) {
        setNewPartnerName('');
        setNewPartnerUrl('');
        await loadPartners();
      }
    } finally {
      setSavingPartner(false);
    }
  }

  async function togglePartner(partnerId: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('wis_api_partners')
      .update({ is_active: !currentStatus })
      .eq('id', partnerId);

    if (!error) {
      await loadPartners();
    }
  }

  async function deletePartner(partnerId: string) {
    if (!confirm('Tem certeza que deseja excluir este parceiro?')) return;

    const { error } = await supabase
      .from('wis_api_partners')
      .delete()
      .eq('id', partnerId);

    if (!error) {
      await loadPartners();
    }
  }

  function openEditPartner(partner: Partner) {
    setEditingPartner(partner);
    setEditPartnerName(partner.partner_name);
    setEditPartnerUrl(partner.api_url_pattern);
    setEditPartnerActive(partner.is_active);
  }

  function closeEditPartner() {
    setEditingPartner(null);
    setEditPartnerName('');
    setEditPartnerUrl('');
    setEditPartnerActive(true);
  }

  async function updatePartner() {
    if (!editingPartner || !editPartnerName.trim() || !editPartnerUrl.trim()) return;

    setUpdatingPartner(true);
    try {
      const { error } = await supabase
        .from('wis_api_partners')
        .update({
          partner_name: editPartnerName.trim(),
          api_url_pattern: editPartnerUrl.trim(),
          is_active: editPartnerActive,
        })
        .eq('id', editingPartner.id);

      if (!error) {
        closeEditPartner();
        await loadPartners();
      }
    } finally {
      setUpdatingPartner(false);
    }
  }

  async function saveErrorMessages() {
    setSavingMessages(true);
    try {
      const updates = errorMessages.map((msg) => ({
        id: msg.id,
        message_text: editedMessages[msg.id] || msg.message_text,
      }));

      for (const update of updates) {
        await supabase
          .from('wis_api_error_messages')
          .update({ message_text: update.message_text })
          .eq('id', update.id);
      }

      await loadErrorMessages();
    } finally {
      setSavingMessages(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);

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
              window.history.pushState({}, '', '/profile#admin');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-6 hover:opacity-80 max-w-6xl"
            style={{
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Voltar ao Painel</span>
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
                    Wis API
                  </h1>
                  <p className="text-xs sm:text-sm mt-1 px-4" style={{ color: colors.textSecondary }}>
                    Gerencie integracoes com parceiros externos
                  </p>
                </div>
              </div>

      <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: colors.textSecondary }} />
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
              Parceiros Autorizados
            </h2>
          </div>
          <button
            onClick={() => {
              window.history.pushState({}, '', '/admin-wis-api-docs');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors hover:opacity-80 w-full sm:w-auto"
            style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}
          >
            <BookText className="w-4 h-4" />
            Wis API Docs
          </button>
        </div>

        <div className="space-y-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.bgPrimary }}
              onClick={() => openEditPartner(partner)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: colors.textPrimary }}>
                    {partner.partner_name}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                      color: colors.textSecondary,
                    }}
                  >
                    {partner.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                  Padrao: {partner.api_url_pattern}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditPartner(partner);
                  }}
                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                  style={{ backgroundColor: colors.bgSecondary }}
                  title="Editar"
                >
                  <Edit3 className="w-4 h-4" style={{ color: colors.textSecondary }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePartner(partner.id, partner.is_active);
                  }}
                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                  style={{ backgroundColor: colors.bgSecondary }}
                  title={partner.is_active ? 'Desativar' : 'Ativar'}
                >
                  {partner.is_active ? (
                    <X className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  ) : (
                    <Check className="w-4 h-4" style={{ color: colors.textSecondary }} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePartner(partner.id);
                  }}
                  className="p-2 rounded-lg transition-colors hover:opacity-80"
                  style={{ backgroundColor: colors.bgSecondary }}
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" style={{ color: colors.textSecondary }} />
                </button>
              </div>
            </div>
          ))}

          <div
            className="p-4 rounded-lg"
            style={{ backgroundColor: colors.bgPrimary }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: colors.textPrimary }}>
              Adicionar novo parceiro
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
                placeholder="Nome do parceiro"
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.borderColor}`,
                }}
              />
              <input
                type="text"
                value={newPartnerUrl}
                onChange={(e) => setNewPartnerUrl(e.target.value)}
                placeholder="Padrao de URL (ex: api.z-api.io%)"
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.borderColor}`,
                }}
              />
              <button
                onClick={addPartner}
                disabled={savingPartner || !newPartnerName.trim() || !newPartnerUrl.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}
              >
                {savingPartner ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" style={{ color: colors.textSecondary }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              Mensagens de Erro
            </h2>
          </div>
          <button
            onClick={saveErrorMessages}
            disabled={savingMessages}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}
          >
            {savingMessages ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>

        <div className="space-y-3">
          {errorMessages.map((msg) => (
            <div
              key={msg.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: colors.bgPrimary }}
            >
              <label className="block text-xs font-mono mb-2" style={{ color: colors.textSecondary }}>
                {msg.error_key}
              </label>
              <textarea
                value={editedMessages[msg.id] || ''}
                onChange={(e) =>
                  setEditedMessages((prev) => ({
                    ...prev,
                    [msg.id]: e.target.value,
                  }))
                }
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  backgroundColor: colors.bgSecondary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.borderColor}`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: colors.textSecondary }} />
            <h2 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
              Logs de Chamadas
            </h2>
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary }}>
              {totalLogs} registros
            </span>
          </div>
          <button
            onClick={loadLogs}
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: colors.bgPrimary }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: colors.textSecondary }} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={logFilter}
            onChange={(e) => {
              setLogFilter(e.target.value as 'all' | 'success' | 'error');
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.borderColor}`,
            }}
          >
            <option value="all">Todos</option>
            <option value="success">Sucesso</option>
            <option value="error">Erro</option>
          </select>

          <select
            value={partnerFilter}
            onChange={(e) => {
              setPartnerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: colors.bgPrimary,
              color: colors.textPrimary,
              border: `1px solid ${colors.borderColor}`,
            }}
          >
            <option value="all">Todos os parceiros</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.partner_name}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Data/Hora</th>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Parceiro</th>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Telefone</th>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Usuario</th>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Status</th>
                <th className="text-left py-3 px-2" style={{ color: colors.textSecondary }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:opacity-80 transition-opacity"
                  style={{ borderBottom: `1px solid ${colors.borderColor}` }}
                >
                  <td className="py-3 px-2" style={{ color: colors.textPrimary }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td className="py-3 px-2" style={{ color: colors.textPrimary }}>
                    {(log.partner as any)?.partner_name || '-'}
                  </td>
                  <td className="py-3 px-2 font-mono text-xs" style={{ color: colors.textPrimary }}>
                    {log.phone_number}
                  </td>
                  <td className="py-3 px-2" style={{ color: colors.textPrimary }}>
                    {log.user_profile
                      ? `${(log.user_profile as any).first_name || ''} ${(log.user_profile as any).last_name || ''}`.trim() || (log.user_profile as any).email
                      : '-'}
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                        color: colors.textSecondary,
                      }}
                    >
                      {log.success ? 'Sucesso' : log.error_key || 'Erro'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                      style={{ backgroundColor: colors.bgPrimary }}
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" style={{ color: colors.textSecondary }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-lg space-y-2"
              style={{ backgroundColor: colors.bgPrimary }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>
                    {formatDate(log.created_at)}
                  </p>
                  <p className="text-sm font-medium truncate" style={{ color: colors.textPrimary }}>
                    {(log.partner as any)?.partner_name || 'Sem parceiro'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(log)}
                  className="p-2 rounded-lg transition-colors hover:opacity-80 flex-shrink-0"
                  style={{ backgroundColor: colors.bgSecondary }}
                  title="Ver detalhes"
                >
                  <Eye className="w-4 h-4" style={{ color: colors.textSecondary }} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono" style={{ color: colors.textSecondary }}>
                  {log.phone_number}
                </p>
                <span
                  className="text-xs px-2 py-1 rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                    color: colors.textSecondary,
                  }}
                >
                  {log.success ? 'Sucesso' : log.error_key || 'Erro'}
                </span>
              </div>
              {log.user_profile && (
                <p className="text-xs truncate" style={{ color: colors.textSecondary }}>
                  {`${(log.user_profile as any).first_name || ''} ${(log.user_profile as any).last_name || ''}`.trim() || (log.user_profile as any).email}
                </p>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: colors.bgPrimary }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: colors.textSecondary }} />
            </button>
            <span className="text-sm" style={{ color: colors.textSecondary }}>
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-auto"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold" style={{ color: colors.textPrimary }}>
                Detalhes do Log
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.bgPrimary }}
              >
                <X className="w-4 h-4" style={{ color: colors.textSecondary }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Data/Hora
                </label>
                <p className="text-sm sm:text-base" style={{ color: colors.textPrimary }}>{formatDate(selectedLog.created_at)}</p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Request Payload
                </label>
                <pre
                  className="p-3 rounded-lg text-[10px] sm:text-xs overflow-auto"
                  style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                >
                  {JSON.stringify(selectedLog.request_payload, null, 2)}
                </pre>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: colors.textSecondary }}>
                  Response Enviada
                </label>
                <pre
                  className="p-3 rounded-lg text-[10px] sm:text-xs overflow-auto"
                  style={{ backgroundColor: colors.bgPrimary, color: colors.textPrimary }}
                >
                  {JSON.stringify(selectedLog.response_sent, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPartner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-xl p-4 sm:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
                </div>
                <h3 className="text-base sm:text-xl font-semibold" style={{ color: colors.textPrimary }}>
                  Editar Parceiro
                </h3>
              </div>
              <button
                onClick={closeEditPartner}
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.bgPrimary }}
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  Nome do Parceiro
                </label>
                <input
                  type="text"
                  value={editPartnerName}
                  onChange={(e) => setEditPartnerName(e.target.value)}
                  placeholder="Ex: Z-API"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderColor}`,
                  }}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  Padrao de URL
                </label>
                <input
                  type="text"
                  value={editPartnerUrl}
                  onChange={(e) => setEditPartnerUrl(e.target.value)}
                  placeholder="Ex: api.z-api.io%"
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    color: colors.textPrimary,
                    border: `1px solid ${colors.borderColor}`,
                  }}
                />
                <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
                  Use % como curinga para corresponder a qualquer parte da URL
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>
                  Status
                </label>
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setEditPartnerActive(true)}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: editPartnerActive
                        ? (theme === 'dark' ? '#52525b' : '#a1a1aa')
                        : colors.bgPrimary,
                      color: colors.textPrimary,
                    }}
                  >
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1.5" />
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPartnerActive(false)}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: !editPartnerActive
                        ? (theme === 'dark' ? '#52525b' : '#a1a1aa')
                        : colors.bgPrimary,
                      color: colors.textPrimary,
                    }}
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1.5" />
                    Inativo
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: colors.borderColor }}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={closeEditPartner}
                    className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors order-2 sm:order-1"
                    style={{
                      backgroundColor: colors.bgPrimary,
                      color: colors.textPrimary,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={updatePartner}
                    disabled={updatingPartner || !editPartnerName.trim() || !editPartnerUrl.trim()}
                    className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-2"
                    style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}
                  >
                    {updatingPartner ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Alteracoes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSearchOpen && (
        <IntelligentSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectProcess={(processoId) => {
            window.history.pushState({}, '', `/lawsuits-detail/${processoId}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}
    </div>
  );
}
