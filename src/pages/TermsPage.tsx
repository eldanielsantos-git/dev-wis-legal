import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface TermsPageProps {
  onBack: () => void;
}

export function TermsPage({ onBack }: TermsPageProps) {
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
              <h1 className="text-3xl font-title font-bold text-gray-900">Termos de Uso</h1>
              <p className="text-sm text-gray-500">Última atualização: 7 de outubro de 2025</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">1. Aceitação dos Termos</h2>
            <p className="text-gray-700 leading-relaxed">
              Ao acessar e utilizar a plataforma Wis Legal, você concorda em cumprir e estar vinculado a estes Termos de Uso.
              Se você não concorda com qualquer parte destes termos, não deve utilizar nossos serviços.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              A plataforma Wis Legal é uma ferramenta tecnológica desenvolvida para transcrição automatizada de documentos
              jurídicos e análise forense de processos, utilizando tecnologia de inteligência artificial do Google Cloud Document AI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">2. Descrição dos Serviços</h2>
            <p className="text-gray-700 leading-relaxed mb-3">A Wis Legal oferece:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Transcrição automatizada de documentos jurídicos em formato PDF</li>
              <li>Análise forense de processos com identificação de padrões e anomalias</li>
              <li>Armazenamento seguro de documentos e transcrições</li>
              <li>Visualização e exportação de análises forenses</li>
              <li>Gerenciamento de múltiplos processos simultaneamente</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">3. Conta de Usuário e Responsabilidades</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Para utilizar a plataforma, você deve criar uma conta fornecendo informações verdadeiras, precisas e completas.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">Você é responsável por:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Todas as atividades realizadas em sua conta</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado</li>
              <li>Garantir que possui os direitos necessários sobre os documentos que envia</li>
              <li>Utilizar a plataforma apenas para fins legítimos e legais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">4. Uso dos Documentos e Propriedade Intelectual</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Você retém todos os direitos sobre os documentos que envia para a plataforma. Ao fazer upload de documentos,
              você nos concede uma licença limitada e não exclusiva para processá-los e gerar as transcrições e análises solicitadas.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              A Wis Legal e seus fornecedores retêm todos os direitos sobre a plataforma, incluindo software, design,
              algoritmos de análise forense e demais elementos proprietários.
            </p>
            <p className="text-gray-700 leading-relaxed">
              As transcrições e análises geradas pela plataforma são de sua propriedade, mas você reconhece que foram
              produzidas por meio de processamento automatizado.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">5. Limitações e Precisão das Análises</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              A plataforma utiliza inteligência artificial e processamento automatizado para gerar transcrições e análises forenses.
              Embora nos esforcemos para fornecer resultados precisos:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Não garantimos 100% de precisão nas transcrições ou análises</li>
              <li>Os resultados devem ser revisados por profissionais qualificados</li>
              <li>Não substituímos o trabalho de advogados ou peritos forenses</li>
              <li>As análises forenses são auxiliares e não devem ser usadas como única fonte de decisão</li>
              <li>A qualidade dos resultados depende da qualidade dos documentos enviados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">6. Processamento de Dados e Terceiros</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Para fornecer nossos serviços, utilizamos o Google Cloud Document AI para processamento de documentos.
              Ao utilizar a plataforma, você concorda que seus documentos sejam processados por este serviço terceirizado.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Todos os dados são tratados de acordo com nossa Política de Privacidade e em conformidade com a
              Lei Geral de Proteção de Dados (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">7. Conduta Proibida</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Você concorda em não:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Fazer upload de documentos que violem direitos de terceiros</li>
              <li>Utilizar a plataforma para atividades ilegais ou fraudulentas</li>
              <li>Tentar acessar áreas restritas ou contas de outros usuários</li>
              <li>Fazer engenharia reversa ou copiar funcionalidades da plataforma</li>
              <li>Sobrecarregar ou interferir no funcionamento da plataforma</li>
              <li>Compartilhar suas credenciais de acesso com terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">8. Suspensão e Cancelamento</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Reservamo-nos o direito de suspender ou cancelar sua conta se detectarmos violações destes Termos de Uso,
              uso abusivo da plataforma ou atividades suspeitas.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Você pode cancelar sua conta a qualquer momento através das configurações de perfil. Após o cancelamento,
              seus dados serão tratados conforme nossa Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">9. Limitação de Responsabilidade</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              A plataforma Wis Legal é fornecida "como está" e "conforme disponível". Não nos responsabilizamos por:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
              <li>Erros ou imprecisões nas transcrições ou análises forenses</li>
              <li>Decisões tomadas com base nos resultados fornecidos pela plataforma</li>
              <li>Interrupções temporárias no serviço por manutenção ou falhas técnicas</li>
              <li>Perda de dados devido a problemas técnicos ou ações de terceiros</li>
              <li>Danos indiretos, incidentais ou consequenciais decorrentes do uso da plataforma</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">10. Modificações nos Termos</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos atualizar estes Termos de Uso periodicamente. Notificaremos sobre mudanças significativas através
              da plataforma ou por email. O uso continuado após as modificações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">11. Lei Aplicável e Jurisdição</h2>
            <p className="text-gray-700 leading-relaxed">
              Estes Termos de Uso são regidos pelas leis brasileiras. Quaisquer disputas serão resolvidas no foro
              da comarca de São Paulo, SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-title font-bold text-gray-900 mb-4">12. Contato</h2>
            <p className="text-gray-700 leading-relaxed">
              Para dúvidas sobre estes Termos de Uso, entre em contato através da plataforma ou pelo email de suporte
              disponível em seu perfil.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
