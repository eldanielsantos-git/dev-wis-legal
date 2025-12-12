import React from 'react';
import { Clock, AlertTriangle, Calendar, FileText, Zap, Shield, Info, TrendingUp } from 'lucide-react';

interface BaseDocumental {
 arquivo?: string;
 pagina?: number | string;
 eventoNoSistema?: string;
}

interface PreclusaoRecente {
 id: string;
 tipo: string;
 atoOuFaseAtingida: string;
 poloAfetado: string;
 dataInicioPrazo?: string;
 dataFinalPrazo?: string;
 baseLegal?: string;
 consequenciaPratica?: string;
 acaoRecomendada?: string;
 baseDocumental?: BaseDocumental;
 observacoes?: string;
}

interface RiscoImediato {
 id: string;
 atoOuFase: string;
 poloAfetado: string;
 prazoFinalEstimado?: string;
 urgencia: string;
 acaoRecomendada?: string;
 baseLegal?: string;
 baseDocumental?: BaseDocumental;
 observacoes?: string;
}

interface Campo {
 id: string;
 label?: string;
 valor: string | string[] | number;
}

interface Secao {
 id: string;
 titulo: string;
 listaPreclusoesRecentes?: PreclusaoRecente[];
 listaRiscosImediatos?: RiscoImediato[];
 campos?: Campo[];
 observacoes?: string;
}

interface MapaPreclusoesProcessuais {
 titulo: string;
 secoes: Secao[];
}

interface MapaPreclusoesViewProps {
 content: string;
}

const getTipoBadge = (tipo: string) => {
 const tipoLower = tipo.toLowerCase();
 if (tipoLower.includes('temporal')) {
  return { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700', icon: Clock };
 }
 if (tipoLower.includes('consumativa')) {
  return { bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-700', icon: Zap };
 }
 if (tipoLower.includes('lógica') || tipoLower.includes('logica')) {
  return { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-700', icon: Shield };
 }
 return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: Info };
};

const getUrgenciaBadge = (urgencia: string) => {
 const urg = urgencia.toLowerCase();
 if (urg.includes('imediata')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (urg.includes('próxima') || urg.includes('proxima')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
};

const getImpactoBadge = (impacto: string) => {
 const imp = impacto.toLowerCase();
 if (imp.includes('alto')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (imp.includes('médio') || imp.includes('medio')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
};

export function MapaPreclusoesView({ content }: MapaPreclusoesViewProps) {
 let parsedData: any = null;
 let mapaPreclusoesProcessuais: MapaPreclusoesProcessuais | null = null;

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

  parsedData = JSON.parse(cleanContent);

  if (parsedData.mapaPreclusoesProcessuais) {
   mapaPreclusoesProcessuais = parsedData.mapaPreclusoesProcessuais;
  } else if (parsedData.titulo && parsedData.secoes) {
   mapaPreclusoesProcessuais = parsedData;
  }
 } catch (error) {
  console.error('Erro ao parsear JSON:', error);
  return (
   <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-red-800">Erro ao processar os dados da análise.</p>
   </div>
  );
 }

 if (!mapaPreclusoesProcessuais || !mapaPreclusoesProcessuais.titulo || !mapaPreclusoesProcessuais.secoes) {
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
    <Clock className="w-8 h-8 text-red-600 dark:text-red-400" />
    {mapaPreclusoesProcessuais.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {mapaPreclusoesProcessuais.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Lista de Preclusões Recentes */}
     {secao.listaPreclusoesRecentes && secao.listaPreclusoesRecentes.length > 0 && (
      <div className="space-y-4">
       {secao.listaPreclusoesRecentes.map((preclusao, index) => {
        const tipoBadge = getTipoBadge(preclusao.tipo);
        const IconeTipo = tipoBadge.icon;

        return (
         <div
          key={preclusao.id}
          className="bg-theme-card border-l-4 border-amber-500 rounded-r-lg overflow-hidden"
         >
          {/* Cabeçalho */}
          <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-amber-200 dark:border-theme-border">
           <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
             <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
             <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
               <h3 className="font-semibold text-theme-text-primary">
                Preclusão {index + 1}
               </h3>
               <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${tipoBadge.bg}`}>
                <IconeTipo className="w-3 h-3" />
                {preclusao.tipo}
               </span>
              </div>
              <p className="text-sm text-theme-text-secondary">
               Polo Afetado: {preclusao.poloAfetado}
              </p>
             </div>
            </div>
           </div>
          </div>

          {/* Conteúdo */}
          <div className="p-4 space-y-4">
           {/* Ato ou Fase Atingida */}
           <div className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
             Ato ou Fase Atingida
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {preclusao.atoOuFaseAtingida}
            </p>
           </div>

           {/* Grid de Informações */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {preclusao.dataInicioPrazo && (
             <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1 flex items-center gap-1">
               <Calendar className="w-3 h-3" />
               Data de Início do Prazo
              </span>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{preclusao.dataInicioPrazo}</p>
             </div>
            )}
            {preclusao.dataFinalPrazo && (
             <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1 flex items-center gap-1">
               <Calendar className="w-3 h-3" />
               Data Final do Prazo
              </span>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{preclusao.dataFinalPrazo}</p>
             </div>
            )}
           </div>

           {/* Base Legal */}
           {preclusao.baseLegal && (
            <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 border border-purple-200 dark:border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Base Legal
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.baseLegal}
             </p>
            </div>
           )}

           {/* Consequência Prática */}
           {preclusao.consequenciaPratica && (
            <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Consequência Prática
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.consequenciaPratica}
             </p>
            </div>
           )}

           {/* Ação Recomendada */}
           {preclusao.acaoRecomendada && (
            <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ação Recomendada
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {preclusao.acaoRecomendada}
             </p>
            </div>
           )}

           {renderBaseDocumental(preclusao.baseDocumental)}
           {renderObservacoes(preclusao.observacoes)}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {/* Lista de Riscos Imediatos */}
     {secao.listaRiscosImediatos && secao.listaRiscosImediatos.length > 0 && (
      <div className="space-y-4">
       {secao.listaRiscosImediatos.map((risco, index) => (
        <div
         key={risco.id}
         className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
        >
         {/* Cabeçalho */}
         <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-red-200 dark:border-theme-border">
          <div className="flex items-start justify-between gap-3">
           <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
             <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-theme-text-primary">
               Risco {index + 1}
              </h3>
             </div>
             <p className="text-sm text-theme-text-secondary">
              Polo Afetado: {risco.poloAfetado}
             </p>
            </div>
           </div>
           <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getUrgenciaBadge(risco.urgencia)}`}>
            {risco.urgencia}
           </span>
          </div>
         </div>

         {/* Conteúdo */}
         <div className="p-4 space-y-4">
          {/* Ato ou Fase */}
          <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
           <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
            Ato ou Fase em Risco
           </h4>
           <p className="text-sm text-theme-text-primary leading-relaxed">
            {risco.atoOuFase}
           </p>
          </div>

          {/* Prazo Final Estimado */}
          {risco.prazoFinalEstimado && (
           <div className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             Prazo Final Estimado
            </h4>
            <p className="text-lg text-amber-700 dark:text-amber-300 font-bold">
             {risco.prazoFinalEstimado}
            </p>
           </div>
          )}

          {/* Ação Recomendada */}
          {risco.acaoRecomendada && (
           <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Zap className="w-4 h-4" />
             Ação Recomendada
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {risco.acaoRecomendada}
            </p>
           </div>
          )}

          {/* Base Legal */}
          {risco.baseLegal && (
           <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 border border-purple-200 dark:border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <Shield className="w-4 h-4" />
             Base Legal
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {risco.baseLegal}
            </p>
           </div>
          )}

          {renderBaseDocumental(risco.baseDocumental)}
          {renderObservacoes(risco.observacoes)}
         </div>
        </div>
       ))}
      </div>
     )}

     {/* Síntese Estratégica Multilateral */}
     {secao.campos && secao.campos.length > 0 && (
      <div className="space-y-4">
       {secao.campos.map((campo) => {
        const isTotalPreclusoes = campo.id === 'total_preclusoes_recentes';
        const isTotalRiscos = campo.id === 'total_riscos_imediatos';
        const isImpacto = campo.id === 'impacto_polo_usuario';
        const isArray = Array.isArray(campo.valor);

        if (isTotalPreclusoes) {
         return (
          <div
           key={campo.id}
           className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 rounded-lg p-6 border border-amber-200 dark:border-amber-700"
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-lg font-bold text-theme-text-primary mb-1">
              {campo.label}
             </h4>
             <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {campo.valor}
             </p>
            </div>
            <AlertTriangle className="w-12 h-12 text-amber-600 dark:text-amber-400 opacity-50" />
           </div>
          </div>
         );
        }

        if (isTotalRiscos) {
         return (
          <div
           key={campo.id}
           className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-lg p-6 border border-red-200 dark:border-red-700"
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-lg font-bold text-theme-text-primary mb-1">
              {campo.label}
             </h4>
             <p className="text-3xl font-bold text-red-700 dark:text-red-300">
              {campo.valor}
             </p>
            </div>
            <Clock className="w-12 h-12 text-red-600 dark:text-red-400 opacity-50" />
           </div>
          </div>
         );
        }

        if (isImpacto) {
         return (
          <div
           key={campo.id}
           className="bg-theme-card rounded-lg p-6 border border-theme-border "
          >
           <h4 className="text-lg font-bold text-theme-text-primary mb-3">
            {campo.label}
           </h4>
           <span className={`inline-flex px-4 py-2 text-base font-bold rounded-lg border ${getImpactoBadge(campo.valor as string)}`}>
            {campo.valor}
           </span>
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

       {renderObservacoes(secao.observacoes)}
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
