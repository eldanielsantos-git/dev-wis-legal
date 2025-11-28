import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface CookiesPageProps {
  onBack: () => void;
}

export function CookiesPage({ onBack }: CookiesPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 font-body">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>
          <div className="flex items-center space-x-4">
            <img
              src="https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-color-white.svg"
              alt="Wis Legal"
              className="h-12 bg-wis-dark p-2 rounded"
            />
            <div>
              <h1 className="text-3xl font-title font-bold text-gray-900">Política de Cookies</h1>
              <p className="text-sm text-gray-500">Última atualização: 7 de outubro de 2025</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">1. O que são Cookies?</h2>
            <p className="text-gray-700 leading-relaxed">
              Cookies são pequenos arquivos de texto armazenados no seu dispositivo (computador, smartphone, tablet)
              quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem de forma
              eficiente, melhorar a experiência do usuário e fornecer informações aos proprietários do site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">2. Como Utilizamos Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              A plataforma Wis Legal utiliza cookies e tecnologias similares para diversos propósitos, incluindo
              autenticação, preferências do usuário, segurança e análise de uso.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">3. Tipos de Cookies Utilizados</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.1 Cookies Essenciais</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Estes cookies são necessários para o funcionamento da plataforma e não podem ser desativados.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mt-3">
                  <p className="font-semibold text-gray-800 mb-2">Cookies de Autenticação (Supabase)</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 text-sm">
                    <li><strong>Nome:</strong> sb-access-token, sb-refresh-token</li>
                    <li><strong>Finalidade:</strong> Manter sua sessão ativa e autenticada</li>
                    <li><strong>Duração:</strong> Sessão (access token) e 30 dias (refresh token)</li>
                    <li><strong>Tipo:</strong> First-party</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.2 Cookies de Funcionalidade</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Permitem que a plataforma lembre suas preferências e personalize sua experiência.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mt-3">
                  <p className="font-semibold text-gray-800 mb-2">Preferências do Usuário</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 text-sm">
                    <li><strong>Nome:</strong> user-preferences</li>
                    <li><strong>Finalidade:</strong> Armazenar preferências de visualização e configurações</li>
                    <li><strong>Duração:</strong> 365 dias</li>
                    <li><strong>Tipo:</strong> First-party</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.3 Cookies de Segurança</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Ajudam a proteger contra ataques maliciosos e mantêm a plataforma segura.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mt-3">
                  <p className="font-semibold text-gray-800 mb-2">Proteção CSRF</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 text-sm">
                    <li><strong>Nome:</strong> csrf-token</li>
                    <li><strong>Finalidade:</strong> Prevenir ataques de falsificação de requisição entre sites</li>
                    <li><strong>Duração:</strong> Sessão</li>
                    <li><strong>Tipo:</strong> First-party</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">3.4 Cookies de Desempenho</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Coletam informações sobre como você utiliza a plataforma para nos ajudar a melhorar o serviço.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mt-3">
                  <p className="font-semibold text-gray-800 mb-2">Análise de Uso</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4 text-sm">
                    <li><strong>Finalidade:</strong> Entender como os usuários interagem com a plataforma</li>
                    <li><strong>Dados coletados:</strong> Páginas visitadas, tempo de uso, ações realizadas</li>
                    <li><strong>Tipo:</strong> Anonimizados</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">4. Armazenamento Local (LocalStorage)</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Além de cookies, utilizamos o LocalStorage do navegador para armazenar dados localmente:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Tokens de autenticação do Supabase</li>
              <li>Estado da sessão do usuário</li>
              <li>Configurações temporárias da interface</li>
              <li>Cache de dados para melhor performance</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Estes dados permanecem no seu dispositivo e não são transmitidos automaticamente para nossos servidores.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">5. Cookies de Terceiros</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Alguns serviços que utilizamos podem definir seus próprios cookies:
            </p>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-800 mb-2">Google Cloud Platform</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Durante o processamento de documentos com Document AI, o Google pode utilizar cookies conforme
                  sua própria política de privacidade.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-gray-800 mb-2">Supabase</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Nossa infraestrutura de autenticação e banco de dados utiliza cookies do Supabase para
                  gerenciar sessões de forma segura.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">6. Duração dos Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Utilizamos dois tipos de cookies quanto à duração:</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Cookies de Sessão</h3>
                <p className="text-gray-700 leading-relaxed">
                  São temporários e expiram quando você fecha o navegador. Usados principalmente para autenticação
                  e navegação.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800">Cookies Persistentes</h3>
                <p className="text-gray-700 leading-relaxed">
                  Permanecem no seu dispositivo até expirarem ou serem excluídos manualmente. Usados para lembrar
                  suas preferências entre sessões.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">7. Gerenciamento de Cookies</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Você tem controle sobre os cookies e pode gerenciá-los de diferentes formas:
            </p>

            <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4">Através do Navegador</h3>
            <p className="text-gray-700 leading-relaxed mb-2">
              A maioria dos navegadores permite que você:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Visualize os cookies armazenados</li>
              <li>Exclua cookies existentes</li>
              <li>Bloqueie cookies de terceiros</li>
              <li>Bloqueie todos os cookies</li>
              <li>Configure avisos antes de aceitar cookies</li>
            </ul>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-yellow-800 text-sm">
                <strong>Atenção:</strong> Bloquear ou excluir cookies essenciais pode afetar o funcionamento
                da plataforma. Você pode não conseguir fazer login ou usar recursos importantes.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-6">Instruções por Navegador</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies e outros dados do site</li>
              <li><strong>Firefox:</strong> Preferências → Privacidade e Segurança → Cookies e dados de sites</li>
              <li><strong>Safari:</strong> Preferências → Privacidade → Gerenciar Dados de Sites</li>
              <li><strong>Edge:</strong> Configurações → Cookies e permissões do site → Cookies e dados do site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">8. Consentimento</h2>
            <p className="text-gray-700 leading-relaxed">
              Ao continuar usando a plataforma Wis Legal, você concorda com o uso de cookies conforme descrito
              nesta política. Para cookies não essenciais, solicitaremos seu consentimento explícito quando aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">9. Atualizações desta Política</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos atualizar esta Política de Cookies periodicamente para refletir mudanças em nossa prática
              ou por razões operacionais, legais ou regulatórias. Recomendamos revisar esta página regularmente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">10. Mais Informações</h2>
            <p className="text-gray-700 leading-relaxed">
              Para mais informações sobre como tratamos seus dados pessoais, consulte nossa Política de Privacidade.
              Para dúvidas sobre cookies, entre em contato através do canal de suporte disponível em seu perfil.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
