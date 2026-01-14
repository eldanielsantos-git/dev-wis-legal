import React from 'react';
import { FileText, Clock, Scale, AlertCircle } from 'lucide-react';
import { isNonEmptyArray, safeExtractString } from '../../utils/typeGuards';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface Campo {
 id: string;
 label: string;
 valor?: string;
 paginas_referencia?: string;
}

interface ProximaProvidencia {
 parte: string;
 providencia: string;
 prazo: string;
 carater_urgencia?: boolean;
 paginas_referencia?: string;
}

interface StatusProcessual {
 descricao: string;
 paginas_referencia?: string;
 proximaProvidencia: ProximaProvidencia;
}

interface ArgumentoPorPolo {
 id: string;
 titulo: string;
 fundamentacaoLegal?: string;
 fatosRelevantes?: string;
 consistenciaJurisprudencial?: string;
 paginas_referencia?: string;
}

interface QuestaoCentral {
 titulo: string;
 descricao: string;
 paginas_referencia?: string;
 argumentosPorPolo: ArgumentoPorPolo[];
}

interface Secao {
 id: string;
 titulo: string;
 campos?: Campo[];
 statusProcessual?: StatusProcessual;
 questaoCentral?: QuestaoCentral;
}

interface ResumoEstrategico {
 titulo: string;
 secoes: Secao[];
}

interface ResumoEstrategicoViewProps {
 content: string;
}

export function ResumoEstrategicoView({ content }: ResumoEstrategicoViewProps) {
 const normalizationResult = normalizeGenericView(content, 'resumoEstrategico', ['resumo_estrategico', 'resumo']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let data: { resumoEstrategico: ResumoEstrategico } | null = null;

 try {
  data = JSON.parse(content);
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.resumoEstrategico) {
  return <AnalysisContentRenderer content={content} />;
 }

 const { resumoEstrategico } = data;

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {resumoEstrategico.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(resumoEstrategico.secoes) && resumoEstrategico.secoes.map((secao) => (
    <div
     key={secao.id}
     className="bg-theme-card border border-theme-border rounded-lg p-6 space-y-4"
    >
     {/* Título da Seção */}
     <h2 className="text-lg font-semibold text-theme-text-primary border-b border-theme-border pb-2 mb-4">
      {secao.titulo}
     </h2>

     {/* Renderizar campos (lista de label: valor) */}
     {secao.campos && secao.campos.length > 0 && (
      <div className={
        safeExtractString(secao.titulo).toLowerCase().includes('informação') ||
        safeExtractString(secao.titulo).toLowerCase().includes('informações')
          ? 'space-y-4'
          : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
      }>
       {secao.campos.map((campo) => {
        const labelStr = safeExtractString(campo.label);
        const isDate = labelStr.toLowerCase().includes('data');
        const isValor = labelStr.toLowerCase().includes('valor');
        const isPagina = labelStr.toLowerCase().includes('página');

        const valorStr = safeExtractString(campo.valor);
        return (
         <div
          key={campo.id}
          className="bg-theme-bg-tertiary border border-theme-border rounded-lg p-4"
         >
          <div className="font-semibold text-theme-text-primary text-sm mb-2">
           {labelStr || 'Campo'}
          </div>
          {valorStr ? (
           <div className={`text-base ${
             isValor
               ? 'text-[#a8ccf5] font-medium text-lg'
               : isDate || isPagina
               ? 'text-theme-text-secondary'
               : 'text-theme-text-secondary'
           }`}>
            {valorStr}
           </div>
          ) : (
           <div className="text-gray-500 dark:text-gray-400 italic text-sm">
            Dado não identificado
           </div>
          )}
         </div>
        );
       })}
      </div>
     )}

     {/* Renderizar Status Processual */}
     {secao.statusProcessual && (
      <div className="mt-4 space-y-4">
       {/* Descrição do Status */}
       <div className="bg-theme-bg-tertiary rounded-lg p-4 border border-theme-border">
        <div className="flex items-start gap-3">
         <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
         <div className="flex-1">
          <h3 className="text-sm font-semibold text-theme-text-primary mb-2">
           Status Processual
          </h3>
          <p className="text-sm text-theme-text-primary leading-relaxed">
           {secao.statusProcessual.descricao}
          </p>
         </div>
        </div>
       </div>

       {/* Próxima Providência */}
       <div className={`bg-theme-bg-tertiary rounded-lg p-4 border ${secao.statusProcessual.proximaProvidencia.carater_urgencia ? 'border-red-500 dark:border-red-400' : 'border-theme-border'}`}>
        <div className="flex items-start gap-3">
         <Clock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${secao.statusProcessual.proximaProvidencia.carater_urgencia ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
         <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
           <h3 className="text-sm font-semibold text-theme-text-primary">
            Próxima Providência
           </h3>
           {secao.statusProcessual.proximaProvidencia.carater_urgencia && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
             Urgente
            </span>
           )}
          </div>
          <div className="space-y-2 text-sm">
           <p className="text-theme-text-primary">
            <span className="font-medium text-gray-800 dark:text-gray-200">
             Parte:
            </span>{' '}
            {secao.statusProcessual.proximaProvidencia.parte}
           </p>
           <p className="text-theme-text-primary">
            <span className="font-medium text-gray-800 dark:text-gray-200">
             Providência:
            </span>{' '}
            {secao.statusProcessual.proximaProvidencia.providencia}
           </p>
           <p className="text-theme-text-primary">
            <span className="font-medium text-gray-800 dark:text-gray-200">
             Prazo:
            </span>{' '}
            {secao.statusProcessual.proximaProvidencia.prazo}
           </p>
          </div>
         </div>
        </div>
       </div>
      </div>
     )}

     {/* Renderizar Questão Central */}
     {secao.questaoCentral && (
      <div className="mt-4 space-y-4">
       {/* Descrição da Questão Central */}
       <div className="bg-theme-bg-tertiary rounded-lg p-4 border border-theme-border">
        <div className="flex items-start gap-3">
         <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
         <div className="flex-1">
          <h3 className="text-sm font-semibold text-theme-text-primary mb-2">
           {secao.questaoCentral.titulo}
          </h3>
          <p className="text-sm text-theme-text-primary leading-relaxed">
           {secao.questaoCentral.descricao}
          </p>
         </div>
        </div>
       </div>

       {/* Argumentos por Polo */}
       <div className="space-y-3">
        {isNonEmptyArray(secao.questaoCentral.argumentosPorPolo) && secao.questaoCentral.argumentosPorPolo.map((argumento) => (
         <div
          key={argumento.id}
          className="bg-theme-bg-tertiary rounded-lg p-4 border border-theme-border"
         >
          <div className="flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
           <div className="flex-1 space-y-3">
            <h4 className="font-semibold text-theme-text-primary">
             {argumento.titulo}
            </h4>

            {/* Fundamentação Legal */}
            {argumento.fundamentacaoLegal && (
             <div>
              <p className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide mb-1">
               Fundamentação Legal
              </p>
              <p className="text-sm text-theme-text-primary">
               {argumento.fundamentacaoLegal}
              </p>
             </div>
            )}

            {/* Fatos Relevantes */}
            {argumento.fatosRelevantes && (
             <div>
              <p className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide mb-1">
               Fatos Relevantes
              </p>
              <p className="text-sm text-theme-text-primary leading-relaxed">
               {argumento.fatosRelevantes}
              </p>
             </div>
            )}

            {/* Consistência Jurisprudencial */}
            {argumento.consistenciaJurisprudencial && (
             <div className="bg-blue-50 dark:bg-wis-dark/50 rounded p-3 border border-theme-border">
              <p className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide mb-1">
               Consistência Jurisprudencial
              </p>
              <p className="text-sm text-theme-text-primary leading-relaxed">
               {argumento.consistenciaJurisprudencial}
              </p>
             </div>
            )}
           </div>
          </div>
         </div>
        ))}
       </div>
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
