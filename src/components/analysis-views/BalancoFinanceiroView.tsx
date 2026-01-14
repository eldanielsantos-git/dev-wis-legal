import { DollarSign, FileText, Lock, Unlock, Scale, BadgeDollarSign, Receipt, Calculator, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { isNonEmptyArray, safeExtractString } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface BaseDocumental {
 arquivo?: string;
 pagina?: string;
 eventoNoSistema?: string;
}

interface Campo {
 id: string;
 label?: string;
 valor?: string | number;
}

interface Honorario {
 id: string;
 tipo?: string;
 percentualOuValor?: string;
 valorEstimado?: string;
 faseFixacao?: string;
 poloBeneficiado?: string;
 baseLegal?: string;
 dataFixacao?: string;
 paginaReferencia?: string;
 situacao?: string;
 observacoes?: string;
}

interface Constricao {
 id: string;
 tipo?: string;
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
 if (safeIncludes(situacao, 'execução') || safeIncludes(situacao, 'execucao')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (safeIncludes(situacao, 'revogado') || safeIncludes(situacao, 'compensado')) {
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
 }
 return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600';
};

const getStatusAtualizacaoBadge = (status: string | undefined) => {
 if (safeIncludes(status, 'homologado')) {
  return {
   classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700',
   icon: CheckCircle
  };
 }
 if (safeIncludes(status, 'impugnado')) {
  return {
   classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700',
   icon: AlertCircle
  };
 }
 if (safeIncludes(status, 'pendente')) {
  return {
   classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700',
   icon: Clock
  };
 }
 return {
  classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border',
  icon: null
 };
};

const isMonetaryValue = (valor: unknown): boolean => {
 const valorStr = safeExtractString(valor);
 if (!valorStr) return false;
 const monetary = valorStr.toLowerCase();
 return (
  monetary.includes('r$') ||
  monetary.includes('real') ||
  monetary.includes('reais') ||
  /^\d+[.,]\d{2}$/.test(valorStr)
 );
};

export function BalancoFinanceiroView({ content }: BalancoFinanceiroViewProps) {
 const normalizationResult = normalizeGenericView(content, 'balancoFinanceiro', ['balanco_financeiro', 'balanco', 'financeiro']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

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
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.balancoFinanceiro) {
  return <AnalysisContentRenderer content={content} />;
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
       <span className="text-xs font-semibold text-theme-text-secondary uppercase">Pagina</span>
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
     Observacoes
    </h4>
    <p className="text-sm text-theme-text-primary leading-relaxed">
     {observacoes}
    </p>
   </div>
  );
 };

 const renderCampo = (campo: Campo, isConsolidacao: boolean, isValorCausa: boolean) => {
  const valor = campo.valor;
  if (valor === null || valor === undefined) return null;

  const isValorMonetario = typeof valor === 'string' && isMonetaryValue(valor);
  const isStatusAtualizacao = campo.id === 'status_atualizacao';
  const isDataField = campo.id?.includes('data_');

  if (isStatusAtualizacao && typeof valor === 'string') {
   const statusBadge = getStatusAtualizacaoBadge(valor);
   const StatusIcon = statusBadge.icon;
   return (
    <div
     key={campo.id}
     className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border"
    >
     {campo.label && (
      <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
       {campo.label}
      </span>
     )}
     <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded border ${statusBadge.classes}`}>
      {StatusIcon && <StatusIcon className="w-3.5 h-3.5" />}
      {valor}
     </span>
    </div>
   );
  }

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
    {isDataField ? (
     <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-theme-text-secondary" />
      <p className="text-sm text-theme-text-primary">{valor}</p>
     </div>
    ) : (
     <p
      className={`${
       isValorMonetario
        ? `text-lg font-bold ${isConsolidacao ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`
        : 'text-sm text-theme-text-primary'
      }`}
     >
      {valor}
     </p>
    )}
   </div>
  );
 };

 return (
  <div className="space-y-6">
   <h1 className="text-2xl font-bold text-theme-text-primary flex items-center gap-3">
    <BadgeDollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
    {balancoFinanceiro.titulo}
   </h1>

   {isNonEmptyArray(balancoFinanceiro.secoes) && balancoFinanceiro.secoes.map((secao) => {
    const isConsolidacao = secao.id === 'consolidacao_financeira';
    const isValorCausa = secao.id === 'valor_causa';

    return (
     <div key={secao.id} className="space-y-4">
      <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2 flex items-center gap-2">
       {secao.id === 'valor_causa' && <DollarSign className="w-5 h-5" />}
       {secao.id === 'honorarios_sucumbenciais' && <Scale className="w-5 h-5" />}
       {secao.id === 'constricoes_judiciais' && <Lock className="w-5 h-5" />}
       {secao.id === 'liberacoes_valores' && <Unlock className="w-5 h-5" />}
       {secao.id === 'custas_processuais' && <Receipt className="w-5 h-5" />}
       {isConsolidacao && <Calculator className="w-5 h-5" />}
       {secao.titulo}
      </h2>

      {isNonEmptyArray(secao.campos) && (
       <div
        className={`${
         isConsolidacao
          ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-700/50 border-2 border-green-200 dark:border-green-700/50'
          : 'bg-theme-card border border-theme-border'
        } rounded-lg p-5`}
       >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {secao.campos.map((campo) => renderCampo(campo, isConsolidacao, isValorCausa))}
        </div>

        {renderBaseDocumental(secao.baseDocumental)}
        {renderObservacoes(secao.observacoes)}
       </div>
      )}

      {isNonEmptyArray(secao.listaHonorarios) && (
       <div className="space-y-4">
        {secao.listaHonorarios.map((honorario, index) => (
         <div
          key={honorario.id}
          className="bg-theme-card border-l-4 border-teal-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-teal-50 dark:bg-gray-700/50 px-4 py-3 border-b border-teal-200 dark:border-theme-border">
           <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
             <Scale className="w-5 h-5 text-teal-600 dark:text-teal-400" />
             <h3 className="font-semibold text-theme-text-primary">
              Honorario #{index + 1}{honorario.tipo ? ` - ${honorario.tipo}` : ''}
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
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Percentual/Valor</span>
              <p className="text-sm text-theme-text-primary mt-1 font-medium">{honorario.percentualOuValor}</p>
             </div>
            )}
            {honorario.valorEstimado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Valor Estimado</span>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-bold">{honorario.valorEstimado}</p>
             </div>
            )}
            {honorario.faseFixacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Fase de Fixacao</span>
              <p className="text-sm text-theme-text-primary mt-1">{honorario.faseFixacao}</p>
             </div>
            )}
            {honorario.poloBeneficiado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Polo Beneficiado</span>
              <p className="text-sm text-theme-text-primary mt-1">{honorario.poloBeneficiado}</p>
             </div>
            )}
            {honorario.baseLegal && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Base Legal</span>
              <p className="text-sm text-theme-text-primary mt-1">{honorario.baseLegal}</p>
             </div>
            )}
            {honorario.dataFixacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Data de Fixacao</span>
              <div className="flex items-center gap-2 mt-1">
               <Calendar className="w-4 h-4 text-theme-text-secondary" />
               <p className="text-sm text-theme-text-primary">{honorario.dataFixacao}</p>
              </div>
             </div>
            )}
            {honorario.paginaReferencia && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Referencia</span>
              <p className="text-sm text-theme-text-primary mt-1">{honorario.paginaReferencia}</p>
             </div>
            )}
           </div>
           {renderObservacoes(honorario.observacoes)}
          </div>
         </div>
        ))}
       </div>
      )}

      {isNonEmptyArray(secao.listaConstricoes) && (
       <div className="space-y-4">
        {secao.listaConstricoes.map((constricao, index) => (
         <div
          key={constricao.id}
          className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-red-50 dark:bg-gray-700/50 px-4 py-3 border-b border-red-200 dark:border-theme-border">
           <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
             <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
             <h3 className="font-semibold text-theme-text-primary">
              Constricao #{index + 1}{constricao.tipo ? ` - ${constricao.tipo}` : ''}
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
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Valor Constrito</span>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 font-bold">{constricao.valorConstrito}</p>
             </div>
            )}
            {constricao.dataConstricao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Data</span>
              <div className="flex items-center gap-2 mt-1">
               <Calendar className="w-4 h-4 text-theme-text-secondary" />
               <p className="text-sm text-theme-text-primary">{constricao.dataConstricao}</p>
              </div>
             </div>
            )}
            {constricao.tipoDeBem && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Tipo de Bem</span>
              <p className="text-sm text-theme-text-primary mt-1">{constricao.tipoDeBem}</p>
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

      {isNonEmptyArray(secao.listaLiberacoes) && (
       <div className="space-y-4">
        {secao.listaLiberacoes.map((liberacao, index) => (
         <div
          key={liberacao.id}
          className="bg-theme-card border-l-4 border-green-500 rounded-r-lg overflow-hidden"
         >
          <div className="bg-green-50 dark:bg-gray-700/50 px-4 py-3 border-b border-green-200 dark:border-theme-border">
           <div className="flex items-center gap-3">
            <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-theme-text-primary">
             Liberacao #{index + 1}
            </h3>
           </div>
          </div>

          <div className="p-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {liberacao.valorLiberado && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Valor Liberado</span>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1 font-bold">{liberacao.valorLiberado}</p>
             </div>
            )}
            {liberacao.beneficiario && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Beneficiario</span>
              <p className="text-sm text-theme-text-primary mt-1">{liberacao.beneficiario}</p>
             </div>
            )}
            {liberacao.dataLiberacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Data</span>
              <div className="flex items-center gap-2 mt-1">
               <Calendar className="w-4 h-4 text-theme-text-secondary" />
               <p className="text-sm text-theme-text-primary">{liberacao.dataLiberacao}</p>
              </div>
             </div>
            )}
            {liberacao.meioLiberacao && (
             <div>
              <span className="text-xs font-semibold text-theme-text-secondary uppercase">Meio de Liberacao</span>
              <p className="text-sm text-theme-text-primary mt-1">{liberacao.meioLiberacao}</p>
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
