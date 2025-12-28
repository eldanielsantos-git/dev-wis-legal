import React from 'react';
import { DollarSign, FileText, Lock, Unlock, TrendingUp, Scale, BadgeDollarSign, Receipt, Calculator } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';

interface BaseDocumental {
 arquivo?: string;
 pagina?: number | string;
 eventoNoSistema?: string;
}

interface Campo {
 id: string;
 label?: string;
 valor: string | number;
}

interface Honorario {
 id: string;
 tipo: string;
 percentualOuValor?: string;
 valorEstimado?: string | number;
 faseFixacao?: string;
 poloBeneficiado?: string;
 baseLegal?: string;
 dataFixacao?: string;
 paginaReferencia?: number | string;
 situacao?: string;
 observacoes?: string;
}

interface Constricao {
 id: string;
 tipo: string;
 valorConstrito?: string;
 dataConstricao?: string;
 tipoDeBem?: string;
 situacaoAtual?: string;
 baseDocumental?: BaseDocumental;
 observacoes?: string;
}

interface Liberacao {
 id: string;
 valorLiberado?: string;
 beneficiario?: string;
 dataLiberacao?: string;
 meioLiberacao?: string;
 baseDocumental?: BaseDocumental;
 observacoes?: string;
}

interface Secao {
 id: string;
 titulo: string;
 campos?: Campo[];
 baseDocumental?: BaseDocumental;
 observacoes?: string;
 listaHonorarios?: Honorario[];
 listaConstricoes?: Constricao[];
 listaLiberacoes?: Liberacao[];
}

interface BalancoFinanceiro {
 titulo: string;
 secoes: Secao[];
}

interface BalancoFinanceiroViewProps {
 content: string;
}

const getSituacaoBadge = (situacao: string | undefined) => {
 if (safeIncludes(situacao, 'pago') || safeIncludes(situacao, 'liberado') || safeIncludes(situacao, 'convertido')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (safeIncludes(situacao, 'pendente') || safeIncludes(situacao, 'ativo')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (safeIncludes(situacao, 'execução')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(situacao, 'revogado') || safeIncludes(situacao, 'compensado')) {
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
 }
 return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600';
};

const formatCurrency = (valor: string | number): string => {
 if (typeof valor === 'number') {
  return new Intl.NumberFormat('pt-BR', {
   style: 'currency',
   currency: 'BRL'
  }).format(valor);
 }
 return valor;
};

const isMonetaryValue = (valor: string): boolean => {
 const monetary = valor.toLowerCase();
 return (
  monetary.includes('r$') ||
  monetary.includes('real') ||
  monetary.includes('reais') ||
  /^\d+[.,]\d{2}$/.test(valor)
 );
};

export function BalancoFinanceiroView({ content }: BalancoFinanceiroViewProps) {
 let data: { balancoFinanceiro: BalancoFinanceiro } | null = null;

 try {
  let cleanContent = content.trim();

  if (cleanContent.startsWith('```json')) {
   cleanContent = cleanContent.substring(7);
  } else if (cleanContent.startsWith('```')) {
   cleanContent = cleanContent.substring(3);
  }

  if (cleanContent.endsWith('```')) {
   cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }

  cleanContent = cleanContent.trim();

  data = JSON.parse(cleanContent);
 } catch (error) {
  return (
   <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-800">Erro ao processar os dados da análise.</p>
   </div>
  );
 }

 if (!data?.balancoFinanceiro) {
  return (
   <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
    <p className="text-yellow-800">Estrutura de dados inválida.</p>
   </div>
  );
 }

 const { balancoFinanceiro } = data;

 const renderBaseDocumental = (base?: BaseDocumental) => {
  if (!base) return null;

  const hasData = base.arquivo || base.pagina || base.eventoNoSistema;
  if (!hasData) return null;

  return (
   <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border mt-4">
    <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
     <FileText className="w-4 h-4" />
     Base Documental
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
     {base.arquivo && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Arquivo</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.arquivo}</p>
      </div>
     )}
     {base.pagina && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Página</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.pagina}</p>
      </div>
     )}
     {base.eventoNoSistema && (
      <div>
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Evento</span>
       <p className="text-sm text-theme-text-primary mt-0.5">{base.eventoNoSistema}</p>
      </div>
     )}
    </div>
   </div>
  );
 };

 const renderObservacoes = (observacoes?: string) => {
  if (!observacoes) return null;

  return (
   <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border mt-4">
    <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
     Observações
    </h4>
    <p className="text-sm text-theme-text-primary leading-relaxed">
     {observacoes}
    </p>
   </div>
  );
 };

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary flex items-center gap-3">
    <BadgeDollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
    {balancoFinanceiro.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(balancoFinanceiro.secoes) && balancoFinanceiro.secoes.map((secao) => {
    const isConsolidacao = secao.id === 'consolidacao_financeira';

    return (
     <div key={secao.id} className="space-y-4">
      {/* Título da Seção */}
      <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2 flex items-center gap-2">
       {secao.id === 'valor_causa' && <DollarSign className="w-5 h-5" />}
       {secao.id === 'honorarios_sucumbenciais' && <Scale className="w-5 h-5" />}
       {secao.id === 'constricoes_judiciais' && <Lock className="w-5 h-5" />}
       {secao.id === 'liberacoes_valores' && <Unlock className="w-5 h-5" />}
       {secao.id === 'custas_processuais' && <Receipt className="w-5 h-5" />}
       {isConsolidacao && <Calculator className="w-5 h-5" />}
       {secao.titulo}
      </h2>

      {/* Campos Simples */}
      {secao.campos && secao.campos.length > 0 && (
       <div
        className={`${
         isConsolidacao
          ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-700/50 border-2 border-green-200 dark:border-green-700/50 '
          : 'bg-theme-card border border-theme-border '
        } rounded-lg p-5`}
       >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {secao.campos.map((campo) => {
          const isValorMonetario = typeof campo.valor === 'string' && isMonetaryValue(campo.valor);

          return (
           <div
            key={campo.id}
            className={`${
             isConsolidacao
              ? 'bg-theme-card/80 rounded-lg p-4 border border-theme-border'
              : 'bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border'
            }`}
           >
            {campo.label && (
             <span className={`text-xs font-semibold ${isConsolidacao ? 'text-green-800 dark:text-green-300' : 'text-theme-text-primary'} uppercase tracking-wide block mb-1`}>
              {campo.label}
             </span>
            )}
            <p
             className={`${
              isValorMonetario
               ? `text-lg font-bold ${isConsolidacao ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`
               : 'text-sm text-theme-text-primary'
             }`}
            >
             {typeof campo.valor === 'string' ? campo.valor : campo.valor}
            </p>
           </div>
          );
         })}
        </div>

        {renderBaseDocumental(secao.baseDocumental)}
        {renderObservacoes(secao.observacoes)}
       </div>
      )}

      {/* Lista de Honorários */}
      {secao.listaHonorarios && secao.listaHonorarios.length > 0 && (
       <div className="space-y-4">
        {secao.listaHonorarios.map((honorario, index) => (
         <div
          key={honorario.id}
          className="bg-theme-card border-l-4 border-purple-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-purple-50 dark:bg-gray-700/50 px-4 py-3 border-b border-purple-200 dark:border-theme-border">
           <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
             <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400" />
             <h3 className="font-semibold text-theme-text-primary">
              Honorário #{index + 1} - {honorario.tipo}
             </h3>
            </div>
            {honorario.situacao && (
             <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getSituacaoBadge(honorario.situacao)}`}>
              {honorario.situacao}
             </span>
            )}
           </div>
          </div>

          <div className="p-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {honorario.percentualOuValor && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Percentual/Valor</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-medium">{honorario.percentualOuValor}</p>
             </div>
            )}
            {honorario.valorEstimado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Valor Estimado</span>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-bold">{honorario.valorEstimado}</p>
             </div>
            )}
            {honorario.faseFixacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Fase de Fixação</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{honorario.faseFixacao}</p>
             </div>
            )}
            {honorario.poloBeneficiado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Polo Beneficiado</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{honorario.poloBeneficiado}</p>
             </div>
            )}
            {honorario.baseLegal && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Base Legal</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{honorario.baseLegal}</p>
             </div>
            )}
            {honorario.dataFixacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Data de Fixação</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{honorario.dataFixacao}</p>
             </div>
            )}
            {honorario.paginaReferencia && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Página</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{honorario.paginaReferencia}</p>
             </div>
            )}
           </div>
           {renderObservacoes(honorario.observacoes)}
          </div>
         </div>
        ))}
       </div>
      )}

      {/* Lista de Constrições */}
      {secao.listaConstricoes && secao.listaConstricoes.length > 0 && (
       <div className="space-y-4">
        {secao.listaConstricoes.map((constricao, index) => (
         <div
          key={constricao.id}
          className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-red-200 dark:border-theme-border">
           <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
             <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
             <h3 className="font-semibold text-theme-text-primary">
              Constrição #{index + 1} - {constricao.tipo}
             </h3>
            </div>
            {constricao.situacaoAtual && (
             <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getSituacaoBadge(constricao.situacaoAtual)}`}>
              {constricao.situacaoAtual}
             </span>
            )}
           </div>
          </div>

          <div className="p-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {constricao.valorConstrito && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Valor Constrito</span>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 font-bold">{constricao.valorConstrito}</p>
             </div>
            )}
            {constricao.dataConstricao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Data</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{constricao.dataConstricao}</p>
             </div>
            )}
            {constricao.tipoDeBem && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Tipo de Bem</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{constricao.tipoDeBem}</p>
             </div>
            )}
           </div>
           {renderBaseDocumental(constricao.baseDocumental)}
           {renderObservacoes(constricao.observacoes)}
          </div>
         </div>
        ))}
       </div>
      )}

      {/* Lista de Liberações */}
      {secao.listaLiberacoes && secao.listaLiberacoes.length > 0 && (
       <div className="space-y-4">
        {secao.listaLiberacoes.map((liberacao, index) => (
         <div
          key={liberacao.id}
          className="bg-theme-card border-l-4 border-green-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-theme-border">
           <div className="flex items-center gap-3">
            <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-theme-text-primary">
             Liberação #{index + 1}
            </h3>
           </div>
          </div>

          <div className="p-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {liberacao.valorLiberado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Valor Liberado</span>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1 font-bold">{liberacao.valorLiberado}</p>
             </div>
            )}
            {liberacao.beneficiario && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Beneficiário</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{liberacao.beneficiario}</p>
             </div>
            )}
            {liberacao.dataLiberacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Data</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{liberacao.dataLiberacao}</p>
             </div>
            )}
            {liberacao.meioLiberacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase">Meio de Liberação</span>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{liberacao.meioLiberacao}</p>
             </div>
            )}
           </div>
           {renderBaseDocumental(liberacao.baseDocumental)}
           {renderObservacoes(liberacao.observacoes)}
          </div>
         </div>
        ))}
       </div>
      )}
     </div>
    );
   })}
  </div>
 );
}
