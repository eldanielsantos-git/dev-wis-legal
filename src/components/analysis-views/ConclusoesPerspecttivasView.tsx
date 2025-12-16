import React from 'react';
import { CheckCircle, AlertCircle, FileText, TrendingUp, Target, Lightbulb, Shield } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';

interface Completude {
 nivel: string;
 descricao: string;
 premissasFundamentais?: string[];
}

interface Legibilidade {
 nivel: string;
 descricao: string;
}

interface CoerenciaCronologica {
 status: string;
 observacoes: string;
}

interface Campo {
 id: string;
 label?: string;
 valor: string | string[];
}

interface Secao {
 id: string;
 titulo: string;
 completude?: Completude;
 legibilidade?: Legibilidade;
 coerenciaCronologica?: CoerenciaCronologica;
 campos?: Campo[];
 observacoesFinais?: string;
}

interface ConclusoesPerspectivas {
 titulo: string;
 secoes: Secao[];
}

interface ConclusoesPerspettivasViewProps {
 content: string;
}

const getNivelBadge = (nivel: string) => {
 const nivelLower = nivel.toLowerCase();
 if (nivelLower.includes('alta')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (nivelLower.includes('média') || nivelLower.includes('media')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (nivelLower.includes('baixa')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getCoerenciaColor = (status: string) => {
 const statusLower = status.toLowerCase();
 if (statusLower.includes('coerente') && !statusLower.includes('parcialmente')) {
  return 'text-green-700 dark:text-green-300';
 }
 if (statusLower.includes('parcialmente')) {
  return 'text-amber-700 dark:text-amber-300';
 }
 if (statusLower.includes('incoerente')) {
  return 'text-red-700 dark:text-red-300';
 }
 return 'text-theme-text-primary';
};

const getTendenciaBadge = (tendencia: string) => {
 const tend = tendencia.toLowerCase();
 if (tend.includes('encerramento')) {
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
 }
 if (tend.includes('continuidade')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (tend.includes('recurso')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (tend.includes('executória') || tend.includes('executoria')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600';
};

export function ConclusoesPerspettivasView({ content }: ConclusoesPerspettivasViewProps) {
 let parsedData: any = null;
 let conclusoesPerspectivas: ConclusoesPerspectivas | null = null;

 try {
  parsedData = JSON.parse(content);

  if (parsedData.conclusoesPerspectivas) {
   conclusoesPerspectivas = parsedData.conclusoesPerspectivas;
  } else if (parsedData.titulo && parsedData.secoes) {
   conclusoesPerspectivas = parsedData;
  }
 } catch (error) {
  console.error('Erro ao parsear JSON:', error);
  return (
   <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-800">Erro ao processar os dados da análise.</p>
   </div>
  );
 }

 if (!conclusoesPerspectivas || !conclusoesPerspectivas.titulo || !conclusoesPerspectivas.secoes) {
  console.error('Estrutura inválida. Dados recebidos:', parsedData);
  return (
   <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
    <p className="text-yellow-800">Estrutura de dados inválida.</p>
    <details className="mt-2">
     <summary className="cursor-pointer text-sm font-semibold">Ver dados recebidos</summary>
     <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs overflow-auto max-h-40">
      {JSON.stringify(parsedData, null, 2)}
     </pre>
    </details>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary flex items-center gap-3">
    <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
    {conclusoesPerspectivas.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(conclusoesPerspectivas.secoes) && conclusoesPerspectivas.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Qualidade Documental */}
     {secao.completude && (
      <div className="bg-theme-card rounded-lg border border-theme-border overflow-hidden">
       {/* Completude */}
       <div className="p-5 border-b border-theme-border">
        <div className="flex items-center justify-between mb-3">
         <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Completude
         </h3>
         <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg border ${getNivelBadge(secao.completude.nivel)}`}>
          {secao.completude.nivel}
         </span>
        </div>
        <p className="text-sm text-theme-text-primary leading-relaxed mb-4">
         {secao.completude.descricao}
        </p>
        {secao.completude.premissasFundamentais && secao.completude.premissasFundamentais.length > 0 && (
         <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
          <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
           Premissas Fundamentais
          </h4>
          <ul className="space-y-1">
           {secao.completude.premissasFundamentais.map((premissa, idx) => (
            <li key={idx} className="flex items-start gap-2">
             <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
             <span className="text-sm text-theme-text-primary">{premissa}</span>
            </li>
           ))}
          </ul>
         </div>
        )}
       </div>

       {/* Legibilidade */}
       {secao.legibilidade && (
        <div className="p-5 border-b border-theme-border">
         <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
           <FileText className="w-5 h-5" />
           Legibilidade
          </h3>
          <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg border ${getNivelBadge(secao.legibilidade.nivel)}`}>
           {secao.legibilidade.nivel}
          </span>
         </div>
         <p className="text-sm text-theme-text-primary leading-relaxed">
          {secao.legibilidade.descricao}
         </p>
        </div>
       )}

       {/* Coerência Cronológica */}
       {secao.coerenciaCronologica && (
        <div className="p-5">
         <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
           <CheckCircle className="w-5 h-5" />
           Coerência Cronológica
          </h3>
          <span className={`inline-flex px-3 py-1 text-sm font-bold rounded-lg ${getCoerenciaColor(secao.coerenciaCronologica.status)}`}>
           {secao.coerenciaCronologica.status}
          </span>
         </div>
         <p className="text-sm text-theme-text-primary leading-relaxed">
          {secao.coerenciaCronologica.observacoes}
         </p>
        </div>
       )}
      </div>
     )}

     {/* Confiança da Análise */}
     {secao.campos && secao.id === 'confianca_analise' && (
      <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-700/50 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-700/50 ">
       {secao.campos.map((campo) => {
        const isNivelConfianca = campo.id === 'nivel_confianca';

        return (
         <div key={campo.id} className="mb-4 last:mb-0">
          {campo.label && (
           <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wide mb-2">
            {campo.label}
           </h4>
          )}
          {isNivelConfianca ? (
           <span className={`inline-flex px-4 py-2 text-base font-bold rounded-lg border ${getNivelBadge(campo.valor as string)}`}>
            {campo.valor}
           </span>
          ) : (
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          )}
         </div>
        );
       })}
      </div>
     )}

     {/* Conclusões e Perspectivas Finais */}
     {secao.campos && secao.id === 'conclusoes_perspectivas_finais' && (
      <div className="space-y-4">
       {secao.campos.map((campo) => {
        const isSituacaoAtual = campo.id === 'situacao_atual_processo';
        const isTendencia = campo.id === 'tendencia_evolucao';
        const isRiscosOportunidades = campo.id === 'riscos_oportunidades_juridicas';
        const isProximosPassos = campo.id === 'proximos_passos_possiveis';
        const isArray = Array.isArray(campo.valor);

        if (isSituacaoAtual) {
         return (
          <div
           key={campo.id}
           className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-800/30 rounded-lg p-6 border border-blue-200 dark:border-blue-700"
          >
           <h4 className="text-lg font-bold text-theme-text-primary mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            {campo.label}
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          </div>
         );
        }

        if (isTendencia) {
         return (
          <div
           key={campo.id}
           className="bg-theme-card rounded-lg p-6 border border-theme-border "
          >
           <h4 className="text-lg font-bold text-theme-text-primary mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {campo.label}
           </h4>
           <span className={`inline-flex px-4 py-2 text-base font-bold rounded-lg border ${getTendenciaBadge(campo.valor as string)}`}>
            {campo.valor}
           </span>
          </div>
         );
        }

        if (isRiscosOportunidades) {
         return (
          <div
           key={campo.id}
           className="bg-theme-card rounded-lg p-6 border-l-4 border-amber-500"
          >
           <h4 className="text-lg font-bold text-theme-text-primary mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            {campo.label}
           </h4>
           <ul className="space-y-3">
            {(campo.valor as string[]).map((item, idx) => (
             <li key={idx} className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-theme-text-primary leading-relaxed flex-1">
               {item}
              </p>
             </li>
            ))}
           </ul>
          </div>
         );
        }

        if (isProximosPassos) {
         return (
          <div
           key={campo.id}
           className="bg-theme-card rounded-lg p-6 border-l-4 border-green-500"
          >
           <h4 className="text-lg font-bold text-theme-text-primary mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
            {campo.label}
           </h4>
           <ul className="space-y-3">
            {(campo.valor as string[]).map((item, idx) => (
             <li key={idx} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex-shrink-0">
               {idx + 1}
              </span>
              <p className="text-sm text-theme-text-primary leading-relaxed flex-1">
               {item}
              </p>
             </li>
            ))}
           </ul>
          </div>
         );
        }

        return (
         <div
          key={campo.id}
          className="bg-theme-card rounded-lg p-5 border border-theme-border "
         >
          {campo.label && (
           <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-3">
            {campo.label}
           </h4>
          )}
          {isArray ? (
           <ul className="space-y-2">
            {(campo.valor as string[]).map((item, idx) => (
             <li key={idx} className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <p className="text-sm text-theme-text-primary leading-relaxed flex-1">
               {item}
              </p>
             </li>
            ))}
           </ul>
          ) : (
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          )}
         </div>
        );
       })}

       {/* Observações Finais */}
       {secao.observacoesFinais && (
        <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-5 border border-theme-border">
         <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3">
          Observações Finais
         </h4>
         <p className="text-sm text-theme-text-primary leading-relaxed">
          {secao.observacoesFinais}
         </p>
        </div>
       )}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
