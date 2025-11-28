import React from 'react';
import { Target, Lightbulb, AlertTriangle, DollarSign, TrendingUp, FileText, Info } from 'lucide-react';

interface EstrategiaPrincipal {
 descricao: string;
 fundamentacaoLegal: string;
 finalidadePratica: string;
 riscoProcessual: string;
 custoEstimado: string;
 paginasReferencia?: number | string;
}

interface EstrategiaComplementar {
 id: string;
 descricao: string;
 fundamentacaoLegal?: string;
 finalidadePratica?: string;
 condicaoAdocao: string;
 riscoProcessual: string;
 prioridade: string;
 paginasReferencia?: number | string;
}

interface EstrategiaPolo {
 id: string;
 polo: string;
 situacaoAtualPolo: string;
 estrategiaPrincipal: EstrategiaPrincipal;
 estrategiasComplementares?: EstrategiaComplementar[];
}

interface Campo {
 id: string;
 label?: string;
 valor: string;
}

interface Secao {
 id: string;
 titulo: string;
 listaEstrategias?: EstrategiaPolo[];
 campos?: Campo[];
}

interface EstrategiasJuridicas {
 titulo: string;
 secoes: Secao[];
}

interface EstrategiasJuridicasViewProps {
 content: string;
}

const getRiscoBadge = (risco: string) => {
 const riscoLower = risco.toLowerCase();
 if (riscoLower.includes('baixo')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (riscoLower.includes('médio') || riscoLower.includes('medio')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (riscoLower.includes('alto')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getCustoBadge = (custo: string) => {
 const custoLower = custo.toLowerCase();
 if (custoLower.includes('baixo')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (custoLower.includes('médio') || custoLower.includes('medio')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (custoLower.includes('alto')) {
  return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getPrioridadeBadge = (prioridade: string) => {
 const prioridadeLower = prioridade.toLowerCase();
 if (prioridadeLower.includes('secundária') || prioridadeLower.includes('secundaria')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (prioridadeLower.includes('contingente')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (prioridadeLower.includes('oportunista')) {
  return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const getPoloColor = (polo: string) => {
 const poloLower = polo.toLowerCase();
 if (poloLower.includes('autor')) {
  return {
   bg: 'bg-theme-bg-tertiary',
   border: 'border-blue-200 dark:border-theme-border',
   icon: 'text-blue-600 dark:text-blue-400'
  };
 }
 if (poloLower.includes('réu') || poloLower.includes('reu')) {
  return {
   bg: 'bg-orange-50 dark:bg-gray-700/50',
   border: 'border-orange-100 dark:border-theme-border',
   icon: 'text-orange-600 dark:text-orange-400'
  };
 }
 return {
  bg: 'bg-purple-50 dark:bg-gray-700/50',
  border: 'border-purple-200 dark:border-theme-border',
  icon: 'text-purple-600 dark:text-purple-400'
 };
};

export function EstrategiasJuridicasView({ content }: EstrategiasJuridicasViewProps) {
 let data: { estrategiasJuridicas: EstrategiasJuridicas } | null = null;

 try {
  // Limpar possíveis marcadores de código que podem estar no JSON
  let cleanContent = content.trim();

  // Remover marcadores ```json no início
  if (cleanContent.startsWith('```json')) {
   cleanContent = cleanContent.substring(7);
  }
  if (cleanContent.startsWith('```')) {
   cleanContent = cleanContent.substring(3);
  }

  // Remover marcadores ``` no final
  const lastTripleBacktick = cleanContent.lastIndexOf('```');
  if (lastTripleBacktick > 0) {
   cleanContent = cleanContent.substring(0, lastTripleBacktick);
  }

  cleanContent = cleanContent.trim();

  data = JSON.parse(cleanContent);
 } catch (error) {
  console.error('Erro ao parsear EstrategiasJuridicasView:', error);
  return (
   <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
    <div className="flex items-start gap-3">
     <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
     <div>
      <p className="text-red-800 dark:text-red-200 font-semibold mb-2">Erro ao processar análise</p>
      <p className="text-red-700 dark:text-red-300 text-sm">JSON inválido</p>
     </div>
    </div>
   </div>
  );
 }

 if (!data?.estrategiasJuridicas) {
  return (
   <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
    <p className="text-yellow-800">Estrutura de dados inválida.</p>
   </div>
  );
 }

 const { estrategiasJuridicas } = data;

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {estrategiasJuridicas.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {estrategiasJuridicas.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Estratégias por Polo */}
     {secao.listaEstrategias && secao.listaEstrategias.length > 0 && (
      <div className="space-y-6">
       {secao.listaEstrategias.map((estrategia) => {
        const poloColors = getPoloColor(estrategia.polo);

        return (
         <div
          key={estrategia.id}
          className="bg-theme-card border border-theme-border rounded-lg overflow-hidden"
         >
          {/* Cabeçalho do Polo */}
          <div className={`${poloColors.bg} px-4 py-3 border-b ${poloColors.border}`}>
           <div className="flex items-center gap-3">
            <Target className={`w-5 h-5 ${poloColors.icon} flex-shrink-0`} />
            <h3 className="font-semibold text-theme-text-primary text-lg">
             {estrategia.polo}
            </h3>
           </div>
          </div>

          {/* Conteúdo */}
          <div className="p-4 space-y-5">
           {/* Situação Atual do Polo */}
           <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
             Situação Atual
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {estrategia.situacaoAtualPolo}
            </p>
           </div>

           {/* Estratégia Principal */}
           <div className="border-l-4 border-green-500 bg-green-50 dark:bg-gray-700/30 rounded-r-lg p-4">
            <div className="flex items-center gap-2 mb-3">
             <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
             <h4 className="text-base font-bold text-theme-text-primary">
              Estratégia Principal
             </h4>
            </div>

            <div className="space-y-3">
             {/* Descrição */}
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
               Descrição
              </span>
              <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
               {estrategia.estrategiaPrincipal.descricao}
              </p>
             </div>

             {/* Fundamentação Legal */}
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
               Fundamentação Legal
              </span>
              <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
               {estrategia.estrategiaPrincipal.fundamentacaoLegal}
              </p>
             </div>

             {/* Finalidade Prática */}
             <div>
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
               Finalidade Prática
              </span>
              <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
               {estrategia.estrategiaPrincipal.finalidadePratica}
              </p>
             </div>

             {/* Badges de Risco e Custo */}
             <div className="flex flex-wrap gap-3 pt-2">
              <div>
               <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                Risco Processual
               </span>
               <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRiscoBadge(estrategia.estrategiaPrincipal.riscoProcessual)}`}>
                {estrategia.estrategiaPrincipal.riscoProcessual}
               </span>
              </div>
              <div>
               <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                Custo Estimado
               </span>
               <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getCustoBadge(estrategia.estrategiaPrincipal.custoEstimado)}`}>
                {estrategia.estrategiaPrincipal.custoEstimado}
               </span>
              </div>
              {estrategia.estrategiaPrincipal.paginasReferencia && (
               <div>
                <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                 Páginas de Referência
                </span>
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border">
                 {estrategia.estrategiaPrincipal.paginasReferencia}
                </span>
               </div>
              )}
             </div>
            </div>
           </div>

           {/* Estratégias Complementares */}
           {estrategia.estrategiasComplementares && estrategia.estrategiasComplementares.length > 0 && (
            <div className="space-y-3">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Estratégias Complementares
             </h4>

             {estrategia.estrategiasComplementares.map((comp, index) => (
              <div
               key={comp.id}
               className="border-l-4 border-blue-500 bg-blue-50 dark:bg-gray-700/30 rounded-r-lg p-4"
              >
               <div className="flex items-start justify-between gap-3 mb-3">
                <h5 className="text-sm font-bold text-theme-text-primary">
                 Estratégia Complementar #{index + 1}
                </h5>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getPrioridadeBadge(comp.prioridade)}`}>
                 {comp.prioridade}
                </span>
               </div>

               <div className="space-y-3">
                {/* Descrição */}
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                  Descrição
                 </span>
                 <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                  {comp.descricao}
                 </p>
                </div>

                {/* Fundamentação Legal */}
                {comp.fundamentacaoLegal && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Fundamentação Legal
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.fundamentacaoLegal}
                  </p>
                 </div>
                )}

                {/* Finalidade Prática */}
                {comp.finalidadePratica && (
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                   Finalidade Prática
                  </span>
                  <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                   {comp.finalidadePratica}
                  </p>
                 </div>
                )}

                {/* Condição de Adoção */}
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">
                  Condição de Adoção
                 </span>
                 <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                  {comp.condicaoAdocao}
                 </p>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-3 pt-2">
                 <div>
                  <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                   Risco Processual
                  </span>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getRiscoBadge(comp.riscoProcessual)}`}>
                   {comp.riscoProcessual}
                  </span>
                 </div>
                 {comp.paginasReferencia && (
                  <div>
                   <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
                    Páginas de Referência
                   </span>
                   <span className="inline-flex px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border">
                    {comp.paginasReferencia}
                   </span>
                  </div>
                 )}
                </div>
               </div>
              </div>
             ))}
            </div>
           )}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {/* Considerações Gerais (Campos) */}
     {secao.campos && secao.campos.length > 0 && (
      <div className="space-y-4">
       {secao.campos.map((campo) => (
        <div
         key={campo.id}
         className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-700/50 rounded-lg p-5 border border-theme-border"
        >
         <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           {campo.label && (
            <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide mb-2">
             {campo.label}
            </h4>
           )}
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {campo.valor}
           </p>
          </div>
         </div>
        </div>
       ))}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
