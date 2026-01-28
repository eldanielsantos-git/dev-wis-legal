import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { Settings, Cpu, Scale, AlertTriangle, ArrowRight, Info, Users, Activity, FileText, CreditCard, Tag, Flag, Bell, History } from 'lucide-react';

interface AdminSettingsPageProps {
  onNavigateToApp: () => void;
  onNavigateToMyProcess: () => void;
  onNavigateToChat?: () => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToSchedule?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
  onNavigateToCookies?: () => void;
}

export function AdminSettingsPage({ onNavigateToApp, onNavigateToMyProcess, onNavigateToChat, onNavigateToWorkspace, onNavigateToSchedule, onNavigateToAdmin, onNavigateToProfile, onNavigateToTerms, onNavigateToPrivacy, onNavigateToCookies }: AdminSettingsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  const handleNavigateToModels = () => {
    window.history.pushState({}, '', '/admin-models');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToPrompts = () => {
    window.history.pushState({}, '', '/admin-prompts');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToIntegrity = () => {
    window.history.pushState({}, '', '/admin-integrity');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToUsers = () => {
    window.history.pushState({}, '', '/admin-users');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToTokenCreditsAudit = () => {
    window.history.pushState({}, '', '/admin-token-credits-audit');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToQuota = () => {
    window.history.pushState({}, '', '/admin-quota');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToTags = () => {
    window.history.pushState({}, '', '/admin-tags');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToSubscriptionPlans = () => {
    window.history.pushState({}, '', '/admin-subscription-plans');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToFeatureFlags = () => {
    window.history.pushState({}, '', '/admin-feature-flags');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToSlackNotifications = () => {
    window.history.pushState({}, '', '/admin-slack-notifications');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToStripeDiagnostic = () => {
    window.history.pushState({}, '', '/admin-stripe-diagnostic');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleNavigateToProcessHistory = () => {
    window.history.pushState({}, '', '/admin-process-history');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col items-center mb-6 sm:mb-8">
        <div className="p-2 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
          <Settings className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.textPrimary }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
            Configurações do Sistema
          </h1>
          <p className="text-xs sm:text-sm mt-1 px-4 sm:px-0" style={{ color: colors.textSecondary }}>
            Gerencie as configurações e parâmetros do sistema de análise de processos
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <button
            onClick={handleNavigateToUsers}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Users className="w-8 h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Gestão de Usuários
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Gerencie usuários e permissões do sistema
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#3B82F6' }}>
                  Gerenciar Usuários
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToSubscriptionPlans}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <CreditCard className="w-8 h-8" style={{ color: '#EC4899' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Planos de Assinatura
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Configure planos, benefícios e pacotes de tokens
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#EC4899' }}>
                  Gerenciar Planos
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToTags}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Tag className="w-8 h-8" style={{ color: '#8B5CF6' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Gestão de Tags
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Crie e gerencie tags para classificar processos
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#8B5CF6' }}>
                  Gerenciar Tags
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToQuota}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Activity className="w-8 h-8" style={{ color: '#10B981' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Stripe Gestão Planos e Financeiro
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Gerencie planos Stripe e tokens dos usuários
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#10B981' }}>
                  Gerenciar Cotas
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToTokenCreditsAudit}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <FileText className="w-8 h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Stripe Auditoria de Erros
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Rastreie todas as tentativas de crédito de tokens extras comprados
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#3B82F6' }}>
                  Ver Auditoria
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToStripeDiagnostic}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <CreditCard className="w-8 h-8" style={{ color: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Stripe Diagnóstico
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Diagnostique, sincronize e reconcilie subscriptions órfãs do Stripe
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#EF4444' }}>
                  Diagnosticar Stripe
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToModels}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Cpu className="w-8 h-8" style={{ color: colors.successIcon }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Modelos LLM
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Gerencie os modelos de linguagem do Google Vertex AI utilizados nas análises
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: colors.successIcon }}>
                  Gerenciar Modelos
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToPrompts}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Scale className="w-8 h-8" style={{ color: '#8B5CF6' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Prompts
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Configure os prompts utilizados na análise dos processos
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#8B5CF6' }}>
                  Gerenciar Prompts
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToIntegrity}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: '#F59E0B' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Integridade de Dados
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Monitore e recupere processos com problemas de consolidação ou inconsistências
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#F59E0B' }}>
                  Verificar Integridade
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToFeatureFlags}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Flag className="w-8 h-8" style={{ color: '#3B82F6' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Feature Flags
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Controle o rollout do sistema tier-aware de processamento
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#3B82F6' }}>
                  Gerenciar Flags
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToSlackNotifications}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <Bell className="w-8 h-8" style={{ color: '#10B981' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Notificações Slack
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Configure webhooks do Slack para receber notificações de eventos
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#10B981' }}>
                  Configurar Webhooks
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>

          <button
            onClick={handleNavigateToProcessHistory}
            className="group rounded-lg p-4 shadow-lg transition-all hover:scale-105 hover:shadow-2xl h-full"
            style={{ backgroundColor: colors.bgSecondary }}
          >
            <div className="flex flex-col items-center text-center space-y-3 h-full">
              <div className="p-3 rounded-lg transition-transform group-hover:scale-110" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
                <History className="w-8 h-8" style={{ color: '#F59E0B' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: colors.textPrimary }}>
                  Historico de Processos
                </h3>
                <p className="text-xs break-words" style={{ color: colors.textSecondary }}>
                  Registro permanente de todos os processos concluidos no sistema
                </p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center text-xs font-medium" style={{ color: '#F59E0B' }}>
                  Ver Historico
                  <ArrowRight className="ml-1 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl p-4 sm:p-6 shadow-lg max-w-3xl w-full" style={{ backgroundColor: colors.bgSecondary }}>
          <div className="flex items-start space-x-2 sm:space-x-3">
            <div className="flex-shrink-0 p-1.5 sm:p-2 rounded-lg" style={{ backgroundColor: theme === 'dark' ? '#1F2229' : '#F3F4F6' }}>
              <Info className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#3B82F6' }} />
            </div>
            <div className="flex-1">
              <h4 className="text-xs sm:text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>Informações Importantes</h4>
              <ul className="text-xs sm:text-sm space-y-1.5 sm:space-y-2" style={{ color: colors.textSecondary }}>
                <li className="flex items-start">
                  <span className="mr-1.5 sm:mr-2 flex-shrink-0">•</span>
                  <span className="break-words">Alterações nos prompts criam novas versões mantendo histórico completo</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-1.5 sm:mr-2 flex-shrink-0">•</span>
                  <span className="break-words">Mudanças no modelo LLM ativo afetam todas as análises futuras</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-1.5 sm:mr-2 flex-shrink-0">•</span>
                  <span className="break-words">Sempre teste as configurações em ambiente controlado antes de aplicar em produção</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-1.5 sm:mr-2 flex-shrink-0">•</span>
                  <span className="break-words">Utilize a verificação de integridade regularmente para garantir consistência dos dados</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
