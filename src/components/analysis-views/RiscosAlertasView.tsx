import React from 'react';
import { AlertTriangle, Shield, Clock, FileText, Target, Zap, Info, TrendingUp } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';
import { safeIncludes } from '../../utils/safeStringUtils';

interface BaseDocumental {
 arquivo?: string;
 pagina?: number | string;
 eventoNoSistema?: string;
}

interface Alerta {
 id: string;
 categoria: string;
 descricaoRisco: string;
 baseDocumental?: BaseDocumental;
 poloAfetado: string;
 gravidade: string;
 impactoPoloUsuario: string;
 urgencia: string;
 acaoRecomendada?: string;
 fundamentacaoLegal?: string;
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
 listaAlertas?: Alerta[];
 campos?: Campo[];
}

interface RiscosAlertasProcessuais {
 titulo: string;
 secoes: Secao[];
}

interface RiscosAlertasViewProps {
 content: string;
}

const getGravidadeIcon = (gravidade: string | undefined) => {
 if (safeIncludes(gravidade, 'alta')) {
  return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
 }
 if (safeIncludes(gravidade, 'média') || safeIncludes(gravidade, 'media')) {
  return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
 }
 return <AlertTriangle className="w-5 h-5 text-green-600 dark:text-green-400" />;
};

const getGravidadeBadge = (gravidade: string | undefined) => {
 if (safeIncludes(gravidade, 'alta')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(gravidade, 'média') || safeIncludes(gravidade, 'media')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
};

const getUrgenciaBadge = (urgencia: string | undefined) => {
 if (safeIncludes(urgencia, 'imediata')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(urgencia, 'próxima') || safeIncludes(urgencia, 'proxima')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
};

const getImpactoBadge = (impacto: string | undefined) => {
 if (safeIncludes(impacto, 'direto')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (safeIncludes(impacto, 'indireto')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
};

const getCategoriaBadge = (categoria: string | undefined) => {
 if (safeIncludes(categoria, 'nulidade')) {
  return { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-700', icon: Shield };
 }
 if (safeIncludes(categoria, 'prazos')) {
  return { bg: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700', icon: Clock };
 }
 if (safeIncludes(categoria, 'provas')) {
  return { bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700', icon: FileText };
 }
 if (safeIncludes(categoria, 'custos')) {
  return { bg: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700', icon: TrendingUp };
 }
 if (safeIncludes(categoria, 'estratégia') || safeIncludes(categoria, 'estrategia')) {
  return { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700', icon: Target };
 }
 return { bg: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border', icon: Info };
};

const getRiscoGlobalColor = (risco: string | undefined) => {
 if (safeIncludes(risco, 'alto')) {
  return 'bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-700/30';
 }
 if (safeIncludes(risco, 'médio') || safeIncludes(risco, 'medio')) {
  return 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/30';
 }
 return 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-700/30';
};

export function RiscosAlertasView({ content }: RiscosAlertasViewProps) {
 let data: { riscosAlertasProcessuais: RiscosAlertasProcessuais } | null = null;

 console.log('🚀 RiscosAlertasView - RENDERING', {
  contentLength: content?.length,
  contentType: typeof content,
  firstChars: content?.substring(0, 150)
 });

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
  console.log('✅ RiscosAlertasView - JSON PARSED', {
   hasData: !!data,
   hasRiscosAlertasProcessuais: !!data?.riscosAlertasProcessuais,
   keys: data ? Object.keys(data) : [],
   secoes: data?.riscosAlertasProcessuais?.secoes?.length || 0
  });
 } catch (error) {
  console.error('❌ RiscosAlertasView - PARSE ERROR:', error, { content: content?.substring(0, 200) });

  // Retornar card de erro visível ao invés de null
  return (
   <div className="p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 rounded-lg">
    <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">⚠️ Erro ao processar análise</h3>
    <p className="text-sm text-red-700 dark:text-red-400">Não foi possível fazer o parse do JSON.</p>
    <pre className="mt-2 text-xs bg-red-100 dark:bg-red-950 p-2 rounded overflow-auto max-h-40">
     {content?.substring(0, 300)}...
    </pre>
   </div>
  );
 }

 if (!data?.riscosAlertasProcessuais) {
  console.error('❌ RiscosAlertasView - MISSING STRUCTURE', {
   hasData: !!data,
   dataKeys: data ? Object.keys(data) : [],
   data: JSON.stringify(data).substring(0, 200)
  });

  // Retornar card de erro estrutural ao invés de null
  return (
   <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 rounded-lg">
    <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Estrutura inválida</h3>
    <p className="text-sm text-yellow-700 dark:text-yellow-400">
     O JSON não contém a propriedade <code className="bg-yellow-100 dark:bg-yellow-950 px-1 rounded">riscosAlertasProcessuais</code>
    </p>
    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
     Chaves encontradas: {data ? Object.keys(data).join(', ') : 'nenhuma'}
    </p>
   </div>
  );
 }

 const { riscosAlertasProcessuais } = data;

 console.log('✅ RiscosAlertasView - RENDERING CONTENT', {
  titulo: riscosAlertasProcessuais.titulo,
  numSecoes: riscosAlertasProcessuais.secoes?.length || 0,
  secoes: riscosAlertasProcessuais.secoes?.map(s => ({
   id: s.id,
   titulo: s.titulo,
   alertas: s.listaAlertas?.length || 0,
   campos: s.campos?.length || 0
  }))
 });

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {riscosAlertasProcessuais.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(riscosAlertasProcessuais.secoes) && riscosAlertasProcessuais.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Lista de Alertas */}
     {secao.listaAlertas && secao.listaAlertas.length > 0 && (
      <div className="space-y-4">
       {secao.listaAlertas.map((alerta, index) => {
        const categoriaBadge = getCategoriaBadge(alerta.categoria);
        const IconeCategoria = categoriaBadge.icon;

        return (
         <div
          key={alerta.id}
          className="bg-theme-card border-l-4 border-red-500 rounded-r-lg overflow-hidden"
         >
          {/* Cabeçalho do Alerta */}
          <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-red-200 dark:border-theme-border">
           <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
             {getGravidadeIcon(alerta.gravidade)}
             <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
               <h3 className="font-semibold text-theme-text-primary">
                Alerta {index + 1}
               </h3>
               <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${categoriaBadge.bg}`}>
                <IconeCategoria className="w-3 h-3" />
                {alerta.categoria}
               </span>
              </div>
              <p className="text-sm text-theme-text-secondary">
               Polo Afetado: {alerta.poloAfetado}
              </p>
             </div>
            </div>
            <div className="flex flex-col gap-3">
             <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
               Gravidade
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getGravidadeBadge(alerta.gravidade)}`}>
               {alerta.gravidade}
              </span>
             </div>
             <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
               Urgência de Ação
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getUrgenciaBadge(alerta.urgencia)}`}>
               {alerta.urgencia}
              </span>
             </div>
            </div>
           </div>
          </div>

          {/* Conteúdo do Alerta */}
          <div className="p-4 space-y-4">
           {/* Descrição do Risco */}
           <div className="bg-red-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
            <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
             <AlertTriangle className="w-4 h-4" />
             Descrição do Risco
            </h4>
            <p className="text-sm text-theme-text-primary leading-relaxed">
             {alerta.descricaoRisco}
            </p>
           </div>

           {/* Base Documental */}
           {alerta.baseDocumental && (
            <div className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Base Documental
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {alerta.baseDocumental.arquivo && (
               <div>
                <span className="text-xs font-semibold text-theme-text-secondary uppercase">Arquivo</span>
                <p className="text-sm text-theme-text-primary mt-0.5">{alerta.baseDocumental.arquivo}</p>
               </div>
              )}
              {alerta.baseDocumental.pagina && (
               <div>
                <span className="text-xs font-semibold text-theme-text-secondary uppercase">Página</span>
                <p className="text-sm text-theme-text-primary mt-0.5">{alerta.baseDocumental.pagina}</p>
               </div>
              )}
              {alerta.baseDocumental.eventoNoSistema && (
               <div>
                <span className="text-xs font-semibold text-theme-text-secondary uppercase">Evento</span>
                <p className="text-sm text-theme-text-primary mt-0.5">{alerta.baseDocumental.eventoNoSistema}</p>
               </div>
              )}
             </div>
            </div>
           )}

           {/* Grid de Indicadores */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 border border-theme-border">
             <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide block mb-1">
              Impacto no Polo do Usuário
             </span>
             <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getImpactoBadge(alerta.impactoPoloUsuario)}`}>
              {alerta.impactoPoloUsuario}
             </span>
            </div>
           </div>

           {/* Ação Recomendada */}
           {alerta.acaoRecomendada && (
            <div className="bg-green-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Ação Recomendada
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.acaoRecomendada}
             </p>
            </div>
           )}

           {/* Fundamentação Legal */}
           {alerta.fundamentacaoLegal && (
            <div className="bg-purple-50 dark:bg-gray-700/30 rounded-lg p-4 border border-purple-200 dark:border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Fundamentação Legal
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.fundamentacaoLegal}
             </p>
            </div>
           )}

           {/* Observações */}
           {alerta.observacoes && (
            <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
             <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-2">
              Observações
             </h4>
             <p className="text-sm text-theme-text-primary leading-relaxed">
              {alerta.observacoes}
             </p>
            </div>
           )}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {/* Síntese Geral de Riscos (Campos) */}
     {secao.campos && secao.campos.length > 0 && (
      <div className="space-y-4">
       {secao.campos.map((campo) => {
        const isRiscoGlobal = campo.id === 'risco_global';
        const isNumeroAlertas = campo.id === 'numero_total_alertas';
        const isArray = Array.isArray(campo.valor);

        if (isRiscoGlobal) {
         return (
          <div
           key={campo.id}
           className={`${getRiscoGlobalColor(campo.valor as string)} rounded-lg p-4 border`}
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-sm font-semibold text-theme-text-secondary mb-1">
              {campo.label}
             </h4>
             <p className="text-xl font-bold text-theme-text-primary">
              {campo.valor}
             </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-theme-text-secondary opacity-30" />
           </div>
          </div>
         );
        }

        if (isNumeroAlertas) {
         return (
          <div
           key={campo.id}
           className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/30"
          >
           <div className="flex items-center justify-between">
            <div>
             <h4 className="text-sm font-semibold text-theme-text-secondary mb-1">
              {campo.label}
             </h4>
             <p className="text-xl font-bold text-theme-text-primary">
              {campo.valor}
             </p>
            </div>
            <Info className="w-8 h-8 text-theme-text-secondary opacity-30" />
           </div>
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
          {isArray && isNonEmptyArray(campo.valor) ? (
           <ul className="space-y-2">
            {campo.valor.map((item, idx) => (
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
      </div>
     )}
    </div>
   ))}
  </div>
 );
}
