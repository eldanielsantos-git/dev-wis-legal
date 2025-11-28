import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
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
              <h1 className="text-3xl font-title font-bold text-gray-900">Política de Privacidade</h1>
              <p className="text-sm text-gray-500">Última atualização: 7 de outubro de 2025</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">1. Introdução</h2>
            <p className="text-gray-700 leading-relaxed">
              A Wis Legal está comprometida com a proteção da privacidade e segurança dos dados de seus usuários.
              Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações
              pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">2. Dados Pessoais Coletados</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Coletamos os seguintes tipos de dados pessoais:</p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">2.1 Dados de Cadastro</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Nome completo (primeiro nome e sobrenome)</li>
              <li>Endereço de email</li>
              <li>Telefone com código do país</li>
              <li>Cidade e estado</li>
              <li>Senha criptografada</li>
              <li>Foto de perfil (opcional)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">2.2 Dados de Documentos</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Arquivos PDF enviados para transcrição</li>
              <li>Metadados dos arquivos (nome, tamanho, data de upload)</li>
              <li>Transcrições geradas automaticamente</li>
              <li>Análises forenses produzidas pela plataforma</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">2.3 Dados de Uso</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Histórico de processos criados e acessados</li>
              <li>Logs de atividades na plataforma</li>
              <li>Timestamps de criação e atualização de dados</li>
              <li>Informações de sessão e autenticação</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">3. Finalidade do Tratamento de Dados</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Utilizamos seus dados pessoais para:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Criar e gerenciar sua conta de usuário</li>
              <li>Autenticar seu acesso à plataforma</li>
              <li>Processar documentos e gerar transcrições</li>
              <li>Realizar análises forenses dos processos</li>
              <li>Armazenar seus documentos e resultados de forma segura</li>
              <li>Fornecer suporte técnico e atendimento ao cliente</li>
              <li>Melhorar nossos serviços e desenvolver novas funcionalidades</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Enviar comunicações relacionadas ao serviço</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">4. Base Legal para o Tratamento</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Tratamos seus dados pessoais com base nas seguintes bases legais previstas na LGPD:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Consentimento: Ao criar uma conta e aceitar estes termos</li>
              <li>Execução de contrato: Para fornecer os serviços contratados</li>
              <li>Cumprimento de obrigação legal ou regulatória</li>
              <li>Legítimo interesse: Para melhoria dos serviços e segurança</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">5. Compartilhamento de Dados</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Seus dados pessoais podem ser compartilhados nas seguintes situações:
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">5.1 Google Cloud Platform</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Utilizamos o Google Cloud Document AI para processar os documentos enviados. Seus arquivos são enviados
              temporariamente para processamento e transcrição. O Google processa esses dados de acordo com suas próprias
              políticas de privacidade e segurança.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">5.2 Supabase</h3>
            <p className="text-gray-700 leading-relaxed mb-3">
              Utilizamos o Supabase como provedor de infraestrutura para banco de dados, autenticação e armazenamento.
              Todos os dados são protegidos com Row Level Security (RLS) e criptografia.
            </p>

            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">5.3 Exigências Legais</h3>
            <p className="text-gray-700 leading-relaxed">
              Podemos divulgar seus dados se exigido por lei, ordem judicial ou autoridade competente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">6. Segurança dos Dados</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Implementamos medidas técnicas e organizacionais para proteger seus dados:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
              <li>Senhas criptografadas com algoritmos modernos</li>
              <li>Row Level Security (RLS) no banco de dados</li>
              <li>Controles de acesso baseados em autenticação</li>
              <li>Monitoramento de segurança e logs de auditoria</li>
              <li>Backups regulares e redundância de dados</li>
              <li>Testes de segurança periódicos</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">7. Retenção de Dados</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Mantemos seus dados pessoais pelo tempo necessário para:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Fornecer os serviços da plataforma enquanto sua conta estiver ativa</li>
              <li>Cumprir obrigações legais, contábeis e fiscais</li>
              <li>Resolver disputas e fazer cumprir nossos acordos</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Após o cancelamento de sua conta, seus dados serão excluídos ou anonimizados dentro de 90 dias,
              exceto quando a lei exigir retenção por prazo superior.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">8. Seus Direitos como Titular</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              De acordo com a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Confirmação da existência de tratamento de dados</li>
              <li>Acesso aos seus dados pessoais</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados a outro fornecedor</li>
              <li>Eliminação dos dados tratados com seu consentimento</li>
              <li>Informação sobre compartilhamento de dados</li>
              <li>Revogação do consentimento</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Para exercer seus direitos, acesse as configurações de perfil na plataforma ou entre em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">9. Cookies e Tecnologias Similares</h2>
            <p className="text-gray-700 leading-relaxed">
              Utilizamos cookies e tecnologias similares para melhorar sua experiência na plataforma.
              Para mais informações, consulte nossa Política de Cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">10. Transferência Internacional de Dados</h2>
            <p className="text-gray-700 leading-relaxed">
              Alguns de nossos fornecedores (Google Cloud, Supabase) podem estar localizados fora do Brasil.
              Garantimos que essas transferências ocorram apenas para países ou empresas que forneçam nível adequado
              de proteção de dados conforme a LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">11. Menores de Idade</h2>
            <p className="text-gray-700 leading-relaxed">
              Nossos serviços são destinados a maiores de 18 anos. Não coletamos intencionalmente dados de menores
              sem autorização dos pais ou responsáveis legais.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">12. Alterações nesta Política</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas
              através da plataforma ou por email. Recomendamos revisar esta política regularmente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">13. Encarregado de Dados (DPO)</h2>
            <p className="text-gray-700 leading-relaxed">
              Para questões relacionadas à proteção de dados pessoais, você pode entrar em contato com nosso
              Encarregado de Proteção de Dados através do canal de suporte disponível em seu perfil.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">14. Contato</h2>
            <p className="text-gray-700 leading-relaxed">
              Para dúvidas sobre esta Política de Privacidade ou para exercer seus direitos, entre em contato
              através da plataforma ou pelo email de suporte disponível em seu perfil.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
