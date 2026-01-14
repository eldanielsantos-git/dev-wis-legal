import React from 'react';
import { FileText, User, Link as LinkIcon } from 'lucide-react';
import { safeToString } from '../../utils/safeRender';
import { isNonEmptyArray, safeExtractString } from '../../utils/typeGuards';
import { normalizeGenericView } from '../../utils/viewNormalizer';
import { AnalysisContentRenderer } from '../AnalysisContentRenderer';

interface Campo {
 id: string;
 label: string;
 valor: string | any;
}

interface DocumentoAnalisado {
 id: string;
 arquivo: string | any;
 paginas: number;
 tipoProcesso: string;
}

interface Parte {
 id: string;
 nome: string | any;
 cpfCnpj: string | any;
 Polo: string | any;
 poloDoUsuario: boolean;
}

interface EventoProcessual {
 id: string;
 evento: string | any;
 data: string | any;
 resumo: string | any;
}

interface ProcessoRelacionado {
 id: string;
 numero: string | any;
 relacao: string | any;
 notas: string | any;
}

interface Secao {
 id: string;
 titulo: string;
 campos?: Campo[];
 documentosAnalisados?: DocumentoAnalisado[];
 lista?: Parte[];
 eventosProcessuais?: EventoProcessual[];
 processosRelacionados?: ProcessoRelacionado[];
}

interface VisaoGeralProcesso {
 titulo: string;
 secoes: Secao[];
}

interface VisaoGeralProcessoViewProps {
 content: string;
}

export function VisaoGeralProcessoView({ content }: VisaoGeralProcessoViewProps) {
 const normalizationResult = normalizeGenericView(content, 'visaoGeralProcesso', ['visao_geral_processo', 'visaoGeral', 'visao_geral']);

 if (!normalizationResult.success) {
  return <AnalysisContentRenderer content={content} />;
 }

 let data: { visaoGeralProcesso: VisaoGeralProcesso } | null = null;

 try {
  data = JSON.parse(content);
 } catch {
  return <AnalysisContentRenderer content={content} />;
 }

 if (!data?.visaoGeralProcesso) {
  return <AnalysisContentRenderer content={content} />;
 }

 const { visaoGeralProcesso } = data;

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {visaoGeralProcesso.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(visaoGeralProcesso.secoes) && visaoGeralProcesso.secoes.map((secao) => (
    <div
     key={secao.id}
     className="bg-theme-card border border-theme-border rounded-lg p-6 space-y-4"
    >
     {/* Título da Seção */}
     <h2 className="text-lg font-semibold text-theme-text-primary border-b border-theme-border pb-2 mb-4">
      {secao.titulo}
     </h2>

     {/* REGRA A: Renderizar campos (lista de label: valor) */}
     {secao.campos && secao.campos.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
       {secao.campos.map((campo) => {
        const labelStr = safeExtractString(campo.label);
        const isDate = labelStr.toLowerCase().includes('data');
        const isValor = labelStr.toLowerCase().includes('valor');
        const isPagina = labelStr.toLowerCase().includes('página');

        return (
         <div
          key={campo.id}
          className="bg-theme-bg-tertiary border border-theme-border rounded-lg p-4"
         >
          <div className="font-semibold text-theme-text-primary text-sm mb-2">
           {labelStr || 'Campo'}
          </div>
          <div className={`text-base ${
            isValor
              ? 'text-[#a8ccf5] font-medium text-lg'
              : isDate || isPagina
              ? 'text-theme-text-secondary'
              : 'text-theme-text-secondary'
          }`}>
           {safeToString(campo.valor)}
          </div>
         </div>
        );
       })}
      </div>
     )}

     {/* REGRA D: Renderizar documentos analisados */}
     {secao.documentosAnalisados && secao.documentosAnalisados.length > 0 && (
      <div className="space-y-3 mt-4">
       <h3 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide">
        Documentos Analisados
       </h3>
       <div className="space-y-2">
        {secao.documentosAnalisados.map((doc) => (
         <div
          key={doc.id}
          className="flex items-start gap-3 p-3 bg-theme-bg-tertiary rounded-lg border border-theme-border"
         >
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <p className="text-sm font-medium text-theme-text-primary">
            {safeToString(doc.arquivo)}
           </p>
           <p className="text-xs text-theme-text-secondary mt-1">
            {doc.paginas} páginas • {safeToString(doc.tipoProcesso)}
           </p>
          </div>
         </div>
        ))}
       </div>
      </div>
     )}

     {/* REGRA B: Renderizar lista de partes */}
     {secao.lista && secao.lista.length > 0 && (
      <div className="space-y-3">
       {secao.lista.map((parte) => (
        <div
         key={parte.id}
         className="flex items-start gap-3 p-4 bg-theme-bg-tertiary rounded-lg border border-theme-border"
        >
         <User className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
         <div className="flex-1">
          <p className="font-semibold text-theme-text-primary">
           {safeToString(parte.nome)}
          </p>
          <div className="mt-2 space-y-1 text-sm text-theme-text-secondary">
           <p>
            <span className="font-medium text-theme-text-primary">CPF/CNPJ:</span> {safeToString(parte.cpfCnpj)}
           </p>
           <p>
            <span className="font-medium text-theme-text-primary">Polo:</span> {safeToString(parte.Polo)}
           </p>
          </div>
         </div>
        </div>
       ))}
      </div>
     )}

     {/* REGRA C: Renderizar linha do tempo */}
     {secao.eventosProcessuais && secao.eventosProcessuais.length > 0 && (
      <div className="relative space-y-6 pl-8 mt-4">
       {/* Linha vertical */}
       <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-theme-border"></div>

       {secao.eventosProcessuais.map((evento, index) => (
        <div key={evento.id} className="relative">
         {/* Círculo na linha do tempo */}
         <div className="absolute -left-[23px] top-1 w-4 h-4 bg-blue-600 dark:bg-blue-400 rounded-full border-2 border-theme-card"></div>

         {/* Conteúdo do evento */}
         <div className="bg-theme-bg-tertiary rounded-lg p-4 border border-theme-border">
          <h4 className="font-semibold text-theme-text-primary mb-2">
           {safeToString(evento.evento)}
          </h4>
          <p className="text-sm text-theme-text-secondary mb-2">
           <span className="font-medium text-theme-text-primary">Data:</span> {safeToString(evento.data)}
          </p>
          <p className="text-sm text-theme-text-primary leading-relaxed">
           {safeToString(evento.resumo)}
          </p>
         </div>
        </div>
       ))}
      </div>
     )}

     {/* REGRA E: Renderizar processos relacionados */}
     {secao.processosRelacionados && secao.processosRelacionados.length > 0 && (
      <div className="space-y-3 mt-4">
       <h3 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide">
        Processos Relacionados
       </h3>
       <div className="space-y-2">
        {secao.processosRelacionados.map((proc) => (
         <div
          key={proc.id}
          className="flex items-start gap-3 p-3 bg-theme-bg-tertiary rounded-lg border border-theme-border"
         >
          <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
           <p className="font-semibold text-theme-text-primary">
            {safeToString(proc.numero)}
           </p>
           <p className="text-sm text-theme-text-secondary mt-1">
            <span className="font-medium text-theme-text-primary">Relação:</span> {safeToString(proc.relacao)}
           </p>
           {proc.notas && safeToString(proc.notas) !== 'Sem informação complementar' && (
            <p className="text-xs text-theme-text-secondary mt-1">
             {safeToString(proc.notas)}
            </p>
           )}
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
