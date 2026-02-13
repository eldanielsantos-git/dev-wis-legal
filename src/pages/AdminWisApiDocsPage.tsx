import React, { useState } from 'react';
import { SidebarWis } from '../components/SidebarWis';
import { FooterWis } from '../components/FooterWis';
import { IntelligentSearch } from '../components/IntelligentSearch';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import {
  BookOpen,
  ArrowLeft,
  Code2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Server,
  Key,
  Shield,
  Zap,
  FileText,
  Users,
  Clock,
  Globe,
} from 'lucide-react';

interface AdminWisApiDocsPageProps {
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

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

function CodeBlock({ code, title }: CodeBlockProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#f4f4f5' }}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7' }}>
          <span className="text-xs font-mono" style={{ color: colors.textSecondary }}>{title}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: colors.textSecondary }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="font-mono whitespace-pre" style={{ color: theme === 'dark' ? '#a1a1aa' : '#52525b' }}>{code}</code>
      </pre>
    </div>
  );
}

export function AdminWisApiDocsPage({
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
}: AdminWisApiDocsPageProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Visao Geral', icon: BookOpen },
    { id: 'authentication', label: 'Autenticacao', icon: Key },
    { id: 'endpoints', label: 'Endpoints', icon: Server },
    { id: 'errors', label: 'Erros', icon: AlertTriangle },
    { id: 'examples', label: 'Exemplos', icon: Code2 },
  ];

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

          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="p-2.5 sm:p-3 rounded-lg mb-3 sm:mb-4" style={{ backgroundColor: colors.bgSecondary }}>
                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: colors.textSecondary }} />
              </div>
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-title font-bold" style={{ color: colors.textPrimary }}>
                  Wis API Documentation
                </h1>
                <p className="text-xs sm:text-sm mt-2 px-4" style={{ color: colors.textSecondary }}>
                  Documentacao completa para integracao com a API Wis
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 sm:mb-8 justify-center px-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: activeSection === section.id
                        ? (theme === 'dark' ? '#3f3f46' : '#d4d4d8')
                        : colors.bgSecondary,
                      color: colors.textPrimary,
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="whitespace-nowrap">{section.label}</span>
                  </button>
                );
              })}
            </div>

            {activeSection === 'overview' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4" style={{ color: colors.textPrimary }}>
                    O que e a Wis API?
                  </h2>
                  <p className="text-sm sm:text-base leading-relaxed mb-4" style={{ color: colors.textSecondary }}>
                    A Wis API permite que parceiros autorizados enviem documentos PDF para analise automatizada
                    diretamente via integracao de sistemas. E ideal para automacoes de WhatsApp, sistemas de
                    gestao juridica, ou qualquer plataforma que deseje integrar a analise de processos judiciais.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                    <div className="p-3 sm:p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <Zap className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
                        <span className="text-sm sm:text-base font-medium" style={{ color: colors.textPrimary }}>Rapido</span>
                      </div>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Analise iniciada em segundos apos o envio do documento
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <Shield className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
                        <span className="text-sm sm:text-base font-medium" style={{ color: colors.textPrimary }}>Seguro</span>
                      </div>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Autenticacao por parceiro autorizado e validacao de usuario
                      </p>
                    </div>
                    <div className="p-3 sm:p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <Globe className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.textSecondary }} />
                        <span className="text-sm sm:text-base font-medium" style={{ color: colors.textPrimary }}>REST API</span>
                      </div>
                      <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                        Endpoints simples e bem documentados em formato JSON
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4" style={{ color: colors.textPrimary }}>
                    Fluxo de Integracao
                  </h2>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}>1</div>
                      <div>
                        <h3 className="text-sm sm:text-base font-medium mb-1" style={{ color: colors.textPrimary }}>Cadastro do Parceiro</h3>
                        <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                          O parceiro e cadastrado no painel administrativo com um padrao de URL autorizado
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}>2</div>
                      <div>
                        <h3 className="text-sm sm:text-base font-medium mb-1" style={{ color: colors.textPrimary }}>Envio do Documento</h3>
                        <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                          O parceiro envia uma requisicao POST com os dados do documento e telefone do usuario
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}>3</div>
                      <div>
                        <h3 className="text-sm sm:text-base font-medium mb-1" style={{ color: colors.textPrimary }}>Validacao</h3>
                        <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                          A API valida o parceiro, o usuario e o formato do arquivo
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}>4</div>
                      <div>
                        <h3 className="text-sm sm:text-base font-medium mb-1" style={{ color: colors.textPrimary }}>Analise Automatica</h3>
                        <p className="text-xs sm:text-sm" style={{ color: colors.textSecondary }}>
                          O documento e processado e a analise e iniciada automaticamente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'authentication' && (
              <div className="space-y-6">
                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Key className="w-6 h-6" style={{ color: colors.textSecondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                      Autenticacao
                    </h2>
                  </div>

                  <p className="leading-relaxed mb-6" style={{ color: colors.textSecondary }}>
                    A autenticacao da Wis API e baseada em <strong>parceiros autorizados</strong>. Cada parceiro
                    possui um padrao de URL registrado no sistema. Quando uma requisicao e recebida, a API
                    valida se a URL de origem (instanceUrl) corresponde a um parceiro autorizado e ativo.
                  </p>

                  <div className="p-4 rounded-lg border-l-4" style={{ backgroundColor: colors.bgPrimary, borderColor: theme === 'dark' ? '#71717a' : '#a1a1aa' }}>
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                      <div>
                        <h4 className="font-medium mb-1" style={{ color: colors.textPrimary }}>Importante</h4>
                        <p className="text-sm" style={{ color: colors.textSecondary }}>
                          O campo <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgSecondary }}>instanceUrl</code> deve
                          corresponder ao padrao cadastrado para seu parceiro. Requisicoes de URLs nao autorizadas
                          serao rejeitadas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Como funciona a validacao?
                  </h3>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>1. Validacao do Parceiro</span>
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        A API verifica se existe um parceiro ativo cujo padrao de URL corresponde ao <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgSecondary }}>instanceUrl</code> enviado.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>2. Validacao do Usuario</span>
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        O telefone informado e usado para identificar o usuario no sistema. O usuario deve estar
                        cadastrado e possuir uma assinatura ativa.
                      </p>
                    </div>

                    <div className="p-4 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4" style={{ color: colors.textSecondary }} />
                        <span className="font-medium text-sm" style={{ color: colors.textPrimary }}>3. Validacao do Arquivo</span>
                      </div>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        O arquivo deve ser um PDF valido com tamanho maximo de 100MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'endpoints' && (
              <div className="space-y-6">
                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Server className="w-6 h-6" style={{ color: colors.textSecondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                      Endpoint: Upload de Arquivo
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded text-sm font-bold" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#d4d4d8', color: colors.textPrimary }}>POST</span>
                    <code className="text-sm font-mono" style={{ color: colors.textPrimary }}>/functions/v1/wis-api-file-upload</code>
                  </div>

                  <p className="mb-6" style={{ color: colors.textSecondary }}>
                    Envia um documento PDF para analise. O documento pode ser enviado via URL publica ou
                    codificado em Base64.
                  </p>

                  <h3 className="text-lg font-semibold mb-3" style={{ color: colors.textPrimary }}>Headers</h3>
                  <CodeBlock
                    title="Headers da Requisicao"
                    code={`Content-Type: application/json`}
                  />

                  <h3 className="text-lg font-semibold mb-3 mt-6" style={{ color: colors.textPrimary }}>Parametros do Body</h3>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>Parametro</th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>Tipo</th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>Obrigatorio</th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>Descricao</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textPrimary }}>phone</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>string</td>
                          <td className="py-3 px-4"><CheckCircle2 className="w-4 h-4" style={{ color: colors.textSecondary }} /></td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Telefone do usuario (apenas numeros, com DDD)</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textPrimary }}>fileName</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>string</td>
                          <td className="py-3 px-4"><CheckCircle2 className="w-4 h-4" style={{ color: colors.textSecondary }} /></td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Nome do arquivo com extensao .pdf</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textPrimary }}>instanceUrl</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>string</td>
                          <td className="py-3 px-4"><CheckCircle2 className="w-4 h-4" style={{ color: colors.textSecondary }} /></td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>URL da instancia do parceiro (usada para autenticacao)</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>documentUrl</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>string</td>
                          <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7', color: colors.textSecondary }}>Condicional</span></td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>URL publica para download do documento (obrigatorio se base64 nao for enviado)</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>base64</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>string</td>
                          <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7', color: colors.textSecondary }}>Condicional</span></td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Conteudo do arquivo codificado em Base64 (obrigatorio se documentUrl nao for enviado)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {[
                      { param: 'phone', type: 'string', required: true, desc: 'Telefone do usuario (apenas numeros, com DDD)' },
                      { param: 'fileName', type: 'string', required: true, desc: 'Nome do arquivo com extensao .pdf' },
                      { param: 'instanceUrl', type: 'string', required: true, desc: 'URL da instancia do parceiro (usada para autenticacao)' },
                      { param: 'documentUrl', type: 'string', required: 'Condicional', desc: 'URL publica para download do documento (obrigatorio se base64 nao for enviado)' },
                      { param: 'base64', type: 'string', required: 'Condicional', desc: 'Conteudo do arquivo codificado em Base64 (obrigatorio se documentUrl nao for enviado)' },
                    ].map((item) => (
                      <div key={item.param} className="p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                        <div className="flex items-center justify-between mb-2">
                          <code className="font-mono text-sm" style={{ color: colors.textPrimary }}>{item.param}</code>
                          {item.required === true ? (
                            <CheckCircle2 className="w-4 h-4" style={{ color: colors.textSecondary }} />
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7', color: colors.textSecondary }}>
                              {item.required}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-1" style={{ color: colors.textSecondary }}>{item.type}</p>
                        <p className="text-xs" style={{ color: colors.textSecondary }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-4 rounded-lg border-l-4" style={{ backgroundColor: colors.bgPrimary, borderColor: theme === 'dark' ? '#71717a' : '#a1a1aa' }}>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      <strong style={{ color: colors.textPrimary }}>Nota:</strong> Voce deve enviar <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgSecondary }}>documentUrl</code> OU <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgSecondary }}>base64</code>,
                      mas nao ambos. Se ambos forem enviados, <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgSecondary }}>documentUrl</code> tera prioridade.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Respostas</h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-5 h-5" style={{ color: colors.textSecondary }} />
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Sucesso (200 OK)</span>
                      </div>
                      <CodeBlock
                        title="Response - Sucesso"
                        code={`{
  "success": true,
  "processo_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Arquivo recebido e analise iniciada"
}`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5" style={{ color: colors.textSecondary }} />
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Erro (400/401/500)</span>
                      </div>
                      <CodeBlock
                        title="Response - Erro"
                        code={`{
  "success": false,
  "error_key": "user_not_found",
  "message": "Usuario nao encontrado. Certifique-se de que o telefone esta cadastrado."
}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'errors' && (
              <div className="space-y-6">
                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6" style={{ color: colors.textSecondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                      Codigos de Erro
                    </h2>
                  </div>

                  <p className="mb-6" style={{ color: colors.textSecondary }}>
                    A API retorna erros estruturados com um <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgPrimary }}>error_key</code> que
                    identifica o tipo de erro e uma mensagem descritiva.
                  </p>

                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>error_key</th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>HTTP Status</th>
                          <th className="text-left py-3 px-4 font-semibold" style={{ color: colors.textPrimary }}>Descricao</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>partner_not_authorized</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>401</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>O parceiro nao esta autorizado ou a URL nao corresponde ao padrao cadastrado</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>user_not_found</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>404</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Nenhum usuario encontrado com o telefone informado</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>no_active_subscription</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>403</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>O usuario nao possui uma assinatura ativa</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>invalid_request</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>400</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Parametros obrigatorios ausentes ou invalidos</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>invalid_file_format</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>400</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>O arquivo nao e um PDF valido</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>file_too_large</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>400</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>O arquivo excede o tamanho maximo de 100MB</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>download_failed</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>400</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Nao foi possivel baixar o arquivo da URL fornecida</td>
                        </tr>
                        <tr style={{ borderBottom: `1px solid ${colors.borderColor}` }}>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>upload_failed</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>500</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>Erro interno ao processar o upload do arquivo</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono text-sm" style={{ color: colors.textSecondary }}>analysis_start_failed</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>500</td>
                          <td className="py-3 px-4" style={{ color: colors.textSecondary }}>O arquivo foi recebido mas a analise nao pode ser iniciada</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {[
                      { key: 'partner_not_authorized', status: '401', desc: 'O parceiro nao esta autorizado ou a URL nao corresponde ao padrao cadastrado' },
                      { key: 'user_not_found', status: '404', desc: 'Nenhum usuario encontrado com o telefone informado' },
                      { key: 'no_active_subscription', status: '403', desc: 'O usuario nao possui uma assinatura ativa' },
                      { key: 'invalid_request', status: '400', desc: 'Parametros obrigatorios ausentes ou invalidos' },
                      { key: 'invalid_file_format', status: '400', desc: 'O arquivo nao e um PDF valido' },
                      { key: 'file_too_large', status: '400', desc: 'O arquivo excede o tamanho maximo de 100MB' },
                      { key: 'download_failed', status: '400', desc: 'Nao foi possivel baixar o arquivo da URL fornecida' },
                      { key: 'upload_failed', status: '500', desc: 'Erro interno ao processar o upload do arquivo' },
                      { key: 'analysis_start_failed', status: '500', desc: 'O arquivo foi recebido mas a analise nao pode ser iniciada' },
                    ].map((error) => (
                      <div key={error.key} className="p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                        <div className="flex items-center justify-between mb-2">
                          <code className="font-mono text-xs" style={{ color: colors.textSecondary }}>{error.key}</code>
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7', color: colors.textPrimary }}>
                            {error.status}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: colors.textSecondary }}>{error.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>Tratamento de Erros</h3>
                  <p className="mb-4" style={{ color: colors.textSecondary }}>
                    Recomendamos implementar tratamento de erros baseado no <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: colors.bgPrimary }}>error_key</code> para
                    fornecer mensagens adequadas aos seus usuarios:
                  </p>
                  <CodeBlock
                    title="Exemplo de tratamento de erro"
                    code={`async function sendToWisApi(data) {
  try {
    const response = await fetch('https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!result.success) {
      switch (result.error_key) {
        case 'user_not_found':
          console.log('Usuario nao cadastrado no sistema');
          break;
        case 'no_active_subscription':
          console.log('Usuario sem assinatura ativa');
          break;
        case 'partner_not_authorized':
          console.log('Parceiro nao autorizado');
          break;
        default:
          console.log(result.message);
      }
    }

    return result;
  } catch (error) {
    console.error('Erro de conexao:', error);
  }
}`}
                  />
                </div>
              </div>
            )}

            {activeSection === 'examples' && (
              <div className="space-y-6">
                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Code2 className="w-6 h-6" style={{ color: colors.textSecondary }} />
                    <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                      Exemplos Praticos
                    </h2>
                  </div>
                  <p className="mb-6" style={{ color: colors.textSecondary }}>
                    Abaixo estao exemplos completos de como fazer requisicoes para a Wis API.
                  </p>
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Exemplo 1: Envio via URL do documento
                  </h3>
                  <p className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
                    Este e o metodo mais comum, onde voce fornece uma URL publica para download do PDF.
                  </p>

                  <CodeBlock
                    title="cURL"
                    code={`curl -X POST 'https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "11987654321",
    "fileName": "processo-12345.pdf",
    "documentUrl": "https://seu-servidor.com/documentos/processo-12345.pdf",
    "instanceUrl": "https://seu-url-de-api.com/instances/ABC123/token/XYZ789"
  }'`}
                  />

                  <div className="mt-4">
                    <CodeBlock
                      title="JavaScript / Node.js"
                      code={`const response = await fetch(
  'https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone: '11987654321',
      fileName: 'processo-12345.pdf',
      documentUrl: 'https://seu-servidor.com/documentos/processo-12345.pdf',
      instanceUrl: 'https://seu-url-de-api.com/instances/ABC123/token/XYZ789'
    })
  }
);

const data = await response.json();

if (data.success) {
  console.log('Processo criado:', data.processo_id);
  console.log('Mensagem:', data.message);
} else {
  console.error('Erro:', data.error_key, data.message);
}`}
                    />
                  </div>
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Exemplo 2: Envio via Base64
                  </h3>
                  <p className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
                    Use este metodo quando voce ja possui o conteudo do arquivo em memoria.
                  </p>

                  <CodeBlock
                    title="JavaScript / Node.js"
                    code={`const fs = require('fs');

// Ler arquivo e converter para Base64
const pdfBuffer = fs.readFileSync('./processo-12345.pdf');
const base64Content = pdfBuffer.toString('base64');

const response = await fetch(
  'https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone: '11987654321',
      fileName: 'processo-12345.pdf',
      base64: base64Content,
      instanceUrl: 'https://seu-url-de-api.com/instances/ABC123/token/XYZ789'
    })
  }
);

const data = await response.json();
console.log(data);`}
                  />
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Exemplo 3: Python
                  </h3>

                  <CodeBlock
                    title="Python"
                    code={`import requests
import json

url = 'https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload'

payload = {
    'phone': '11987654321',
    'fileName': 'processo-12345.pdf',
    'documentUrl': 'https://seu-servidor.com/documentos/processo-12345.pdf',
    'instanceUrl': 'https://seu-url-de-api.com/instances/ABC123/token/XYZ789'
}

headers = {
    'Content-Type': 'application/json'
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
result = response.json()

if result.get('success'):
    print(f"Processo criado: {result['processo_id']}")
    print(f"Mensagem: {result['message']}")
else:
    print(f"Erro: {result.get('error_key')} - {result.get('message')}")`}
                  />
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                    Exemplo 4: PHP
                  </h3>

                  <CodeBlock
                    title="PHP"
                    code={`<?php

$url = 'https://sua-url-supabase.supabase.co/functions/v1/wis-api-file-upload';

$data = [
    'phone' => '11987654321',
    'fileName' => 'processo-12345.pdf',
    'documentUrl' => 'https://seu-servidor.com/documentos/processo-12345.pdf',
    'instanceUrl' => 'https://seu-url-de-api.com/instances/ABC123/token/XYZ789'
];

$options = [
    'http' => [
        'header'  => "Content-Type: application/json\\r\\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($url, false, $context);
$result = json_decode($response, true);

if ($result['success']) {
    echo "Processo criado: " . $result['processo_id'] . "\\n";
    echo "Mensagem: " . $result['message'] . "\\n";
} else {
    echo "Erro: " . $result['error_key'] . " - " . $result['message'] . "\\n";
}

?>`}
                  />
                </div>

                <div className="rounded-xl p-6" style={{ backgroundColor: colors.bgSecondary }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-5 h-5" style={{ color: colors.textSecondary }} />
                    <h3 className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
                      Limites e Boas Praticas
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                      <div>
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Tamanho maximo do arquivo:</span>
                        <span className="ml-2" style={{ color: colors.textSecondary }}>100MB</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                      <div>
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Formato aceito:</span>
                        <span className="ml-2" style={{ color: colors.textSecondary }}>Apenas PDF (.pdf)</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                      <div>
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Timeout da requisicao:</span>
                        <span className="ml-2" style={{ color: colors.textSecondary }}>60 segundos (recomendado configurar no cliente)</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: colors.textSecondary }} />
                      <div>
                        <span className="font-medium" style={{ color: colors.textPrimary }}>Formato do telefone:</span>
                        <span className="ml-2" style={{ color: colors.textSecondary }}>Apenas numeros com DDD (ex: 11987654321)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <FooterWis
          onNavigateToTerms={onNavigateToTerms}
          onNavigateToPrivacy={onNavigateToPrivacy}
          onNavigateToCookies={onNavigateToCookies}
        />
      </main>

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
