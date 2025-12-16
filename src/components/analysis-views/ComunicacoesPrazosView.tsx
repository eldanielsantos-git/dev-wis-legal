import React from 'react';
import { Mail, FileCheck, AlertTriangle, Clock, CheckCircle, XCircle, Hourglass } from 'lucide-react';
import { isNonEmptyArray } from '../../utils/typeGuards';

interface DetalhesAR {
 nomeManuscrito?: string;
 assinaturaPresente?: string;
 motivoDevolucaoExistente?: string;
 motivoDevolucaoIndicado?: string[];
 notas?: string;
}

interface PrazoDerivado {
 id: string;
 tipoPrazo: string;
 finalidade: string;
 baseLegal?: string;
 dataInicio?: string;
 duracao?: string;
 dataFinal?: string;
 status: string;
 observacoes?: string;
}

interface Destinatario {
 nome: string;
 documento?: string;
 tipo: string;
 status: string;
 dataAto?: string;
 dataJuntada?: string;
 paginaJuntadaAto?: number | string;
 notas?: string;
 pagina?: number | string;
}

interface Ato {
 id: string;
 tipoAto: string;
 modalidade: string;
 destinatario: Destinatario | Destinatario[];
 validadeStatus?: string;
 dataAto?: string;
 dataJuntada?: string;
 referencia?: {
  arquivo?: string;
  paginas?: string | number;
 };
 notas?: string;
 detalhesAR?: DetalhesAR;
 prazosDerivados?: PrazoDerivado[];
}

interface Secao {
 id: string;
 titulo: string;
 listaAtos: Ato[];
}

interface ComunicacoesPrazos {
 titulo: string;
 secoes: Secao[];
}

interface ComunicacoesPrazosViewProps {
 content: string;
}

const getStatusBadgeColor = (status: string) => {
 const statusLower = status.toLowerCase();
 if (statusLower.includes('bem-sucedida') || statusLower.includes('cumprido')) {
  return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-700';
 }
 if (statusLower.includes('frustrada')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 if (statusLower.includes('em curso')) {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-700';
 }
 if (statusLower.includes('suspenso')) {
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-700';
 }
 if (statusLower.includes('esgotado')) {
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-700';
 }
 return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-200 dark:border-theme-border';
};

const normalizeAto = (atoRaw: any): Ato => {
 const ato: Ato = {
  id: atoRaw.id || 'ato_sem_id',
  tipoAto: atoRaw.tipoAto || 'Tipo não identificado',
  modalidade: atoRaw.modalidade || 'Modalidade não identificada',
  destinatario: Array.isArray(atoRaw.destinatario)
   ? atoRaw.destinatario.map((dest: any) => ({
      nome: dest.nome || 'Destinatário não identificado',
      documento: dest.documento,
      tipo: dest.qualificacao || dest.tipo || 'Tipo não identificado',
      status: dest.status || atoRaw.validadeStatus || 'Status não identificado',
      dataAto: dest.dataAto || atoRaw.dataAto,
      dataJuntada: dest.dataJuntada || atoRaw.dataJuntada,
      paginaJuntadaAto: dest.paginaJuntadaAto || atoRaw.referencia?.paginas,
      notas: dest.notas || atoRaw.notas,
      pagina: dest.pagina || atoRaw.referencia?.paginas
     }))
   : {
      nome: atoRaw.destinatario?.nome || 'Destinatário não identificado',
      documento: atoRaw.destinatario?.documento,
      tipo: atoRaw.destinatario?.qualificacao || atoRaw.destinatario?.tipo || 'Tipo não identificado',
      status: typeof atoRaw.statusAto === 'object' ? atoRaw.statusAto?.status : atoRaw.statusAto || atoRaw.destinatario?.status || atoRaw.validadeStatus || 'Status não identificado',
      dataAto: atoRaw.datas?.dataExpedicaoAto || atoRaw.destinatario?.dataAto || atoRaw.dataAto,
      dataJuntada: atoRaw.datas?.dataJuntadaComprovante || atoRaw.destinatario?.dataJuntada || atoRaw.dataJuntada,
      paginaJuntadaAto: atoRaw.referencia?.paginas?.[0] || atoRaw.destinatario?.paginaJuntadaAto,
      notas: atoRaw.notas || (typeof atoRaw.statusAto === 'object' ? atoRaw.statusAto?.justificativa : undefined) || atoRaw.destinatario?.notas,
      pagina: atoRaw.referencia?.paginas?.[0] || atoRaw.destinatario?.pagina
     },
  validadeStatus: atoRaw.validadeStatus,
  dataAto: atoRaw.dataAto,
  dataJuntada: atoRaw.dataJuntada,
  referencia: atoRaw.referencia,
  notas: atoRaw.notas
 };

 if (atoRaw.detalhesAR && atoRaw.detalhesAR.status !== 'Não localizado nos autos') {
  ato.detalhesAR = {
   nomeManuscrito: atoRaw.detalhesAR.nomeManuscritoRecebedor || atoRaw.detalhesAR.nomeManuscrito || atoRaw.detalhesAR.recebedor,
   assinaturaPresente: atoRaw.detalhesAR.assinaturaPresente,
   motivoDevolucaoExistente: atoRaw.detalhesAR.motivoDevolucao ? 'Sim' : atoRaw.detalhesAR.motivoDevolucaoExistente,
   motivoDevolucaoIndicado: atoRaw.detalhesAR.motivoDevolucao ? [atoRaw.detalhesAR.motivoDevolucao] : atoRaw.detalhesAR.motivoDevolucaoIndicado,
   notas: atoRaw.detalhesAR.notas
  };
 }

 if (atoRaw.prazos && Array.isArray(atoRaw.prazos) && atoRaw.prazos.length > 0) {
  ato.prazosDerivados = atoRaw.prazos.map((prazoRaw: any) => ({
   id: prazoRaw.idPrazo || prazoRaw.id || 'prazo_sem_id',
   tipoPrazo: prazoRaw.tipo || prazoRaw.tipoPrazo || 'Tipo não identificado',
   finalidade: prazoRaw.finalidade || 'Finalidade não especificada',
   baseLegal: prazoRaw.baseLegal,
   dataInicio: prazoRaw.calculo?.termoInicial || prazoRaw.termoInicial || prazoRaw.dataInicio,
   duracao: prazoRaw.calculo?.duracaoDias || prazoRaw.duracaoDias || prazoRaw.duracao,
   dataFinal: prazoRaw.calculo?.termoFinal || prazoRaw.termoFinal || prazoRaw.dataFinal,
   status: prazoRaw.calculo?.statusJuridico || prazoRaw.statusJuridico || prazoRaw.status || 'Status não identificado',
   observacoes: prazoRaw.calculo?.observacoes || prazoRaw.observacoes
  }));
 } else if (atoRaw.prazosDerivados && Array.isArray(atoRaw.prazosDerivados)) {
  ato.prazosDerivados = atoRaw.prazosDerivados;
 }

 return ato;
};

const normalizarDados = (rawData: any): { comunicacoesPrazos: ComunicacoesPrazos } | null => {
 if (!rawData?.comunicacoesPrazos) return null;

 const raw = rawData.comunicacoesPrazos;

 if (raw.secoes && Array.isArray(raw.secoes)) {
  const normalizedData = { ...rawData };
  normalizedData.comunicacoesPrazos.secoes = raw.secoes.map((secao: any) => ({
   ...secao,
   listaAtos: secao.listaAtos.map((ato: any) => normalizeAto(ato))
  }));
  return normalizedData;
 }

 if (raw.atosComunicacao && Array.isArray(raw.atosComunicacao)) {
  const secao: Secao = {
   id: 'secao_principal',
   titulo: 'Citações e Intimações',
   listaAtos: raw.atosComunicacao.map((atoRaw: any) => normalizeAto(atoRaw))
  };

  return {
   comunicacoesPrazos: {
    titulo: raw.titulo || 'Comunicações e Prazos',
    secoes: [secao]
   }
  };
 }

 return null;
};

export function ComunicacoesPrazosView({ content }: ComunicacoesPrazosViewProps) {
 let rawData: any = null;

 try {
  rawData = JSON.parse(content);
 } catch (error) {
  return (
   <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
    <p className="text-red-800 dark:text-red-200">Erro ao processar os dados da análise.</p>
   </div>
  );
 }

 const data = normalizarDados(rawData);

 if (!data?.comunicacoesPrazos) {
  return (
   <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
    <p className="text-yellow-800 dark:text-yellow-200">Estrutura de dados inválida.</p>
   </div>
  );
 }

 const { comunicacoesPrazos } = data;

 return (
  <div className="space-y-6">
   {/* Título Principal */}
   <h1 className="text-2xl font-bold text-theme-text-primary">
    {comunicacoesPrazos.titulo}
   </h1>

   {/* Renderizar cada seção */}
   {isNonEmptyArray(comunicacoesPrazos.secoes) && comunicacoesPrazos.secoes.map((secao) => (
    <div key={secao.id} className="space-y-4">
     {/* Título da Seção */}
     <h2 className="text-xl font-semibold text-theme-text-primary border-b border-theme-border pb-2">
      {secao.titulo}
     </h2>

     {/* Lista de Atos */}
     <div className="space-y-6">
      {isNonEmptyArray(secao.listaAtos) && secao.listaAtos.map((ato, index) => (
       <div
        key={ato.id}
        className="bg-theme-card border border-theme-border rounded-lg overflow-hidden"
       >
        {/* Cabeçalho do Ato */}
        <div className="bg-theme-bg-tertiary px-4 py-3 border-b border-theme-border">
         <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1">
           <h3 className="font-semibold text-theme-text-primary">
            Ato {index + 1} - {ato.tipoAto}
           </h3>
           <p className="text-sm text-theme-text-secondary">
            Modalidade: {ato.modalidade}
           </p>
          </div>
         </div>
        </div>

        {/* Conteúdo do Ato */}
        <div className="p-4 space-y-4">
         {/* Status do Ato (se presente no nível do ato) */}
         {ato.validadeStatus && (
          <div className="flex items-center gap-2">
           <span className="text-sm font-medium text-theme-text-primary">Status do Ato:</span>
           <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(ato.validadeStatus)}`}>
            {ato.validadeStatus}
           </span>
          </div>
         )}

         {/* Informações Gerais do Ato */}
         {(ato.dataAto || ato.dataJuntada || ato.referencia) && (
          <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-3 text-sm space-y-2">
           {ato.dataAto && (
            <div>
             <span className="font-medium text-theme-text-primary">Data do Ato:</span>
             <span className="text-gray-900 dark:text-gray-100 ml-2">{ato.dataAto}</span>
            </div>
           )}
           {ato.dataJuntada && (
            <div>
             <span className="font-medium text-theme-text-primary">Data da Juntada:</span>
             <span className="text-gray-900 dark:text-gray-100 ml-2">{ato.dataJuntada}</span>
            </div>
           )}
           {ato.referencia && (
            <div>
             <span className="font-medium text-theme-text-primary">Referência:</span>
             <div className="text-gray-900 dark:text-gray-100 ml-2 mt-1">
              {ato.referencia.arquivo && <div>Arquivo: {ato.referencia.arquivo}</div>}
              {ato.referencia.paginas && <div>Páginas: {ato.referencia.paginas}</div>}
             </div>
            </div>
           )}
          </div>
         )}

         {/* Notas do Ato (se presente no nível do ato) */}
         {ato.notas && !Array.isArray(ato.destinatario) && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
           <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Observações</span>
           <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
            {ato.notas}
           </p>
          </div>
         )}

         {/* Informações do(s) Destinatário(s) */}
         <div className="space-y-3">
          <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide flex items-center gap-2">
           <FileCheck className="w-4 h-4" />
           {Array.isArray(ato.destinatario) ? 'Destinatários' : 'Destinatário'}
          </h4>

          {isNonEmptyArray(ato.destinatario) ? (
           ato.destinatario.map((dest, destIndex) => (
            <div key={destIndex} className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-3">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
               <span className="font-medium text-theme-text-primary">Nome:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{dest.nome}</p>
              </div>
              {dest.documento && (
               <div>
                <span className="font-medium text-theme-text-primary">Documento:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-0.5">{dest.documento}</p>
               </div>
              )}
              <div>
               <span className="font-medium text-theme-text-primary">Tipo:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{dest.tipo}</p>
              </div>
              {dest.status && dest.status !== 'Status não identificado' && (
               <div>
                <span className="font-medium text-theme-text-primary">Status:</span>
                <div className="mt-1">
                 <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(dest.status)}`}>
                  {dest.status}
                 </span>
                </div>
               </div>
              )}
             </div>
            </div>
           ))
          ) : (
           <div className="bg-slate-50 dark:bg-gray-700/30 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
             <div>
              <span className="font-medium text-theme-text-primary">Nome:</span>
              <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.nome}</p>
             </div>
             {ato.destinatario.documento && (
              <div>
               <span className="font-medium text-theme-text-primary">Documento:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.documento}</p>
              </div>
             )}
             <div>
              <span className="font-medium text-theme-text-primary">Tipo:</span>
              <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.tipo}</p>
             </div>
             <div>
              <span className="font-medium text-theme-text-primary">Status:</span>
              <div className="mt-1">
               <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(ato.destinatario.status)}`}>
                {ato.destinatario.status}
               </span>
              </div>
             </div>
             {ato.destinatario.dataAto && (
              <div>
               <span className="font-medium text-theme-text-primary">Data do Ato:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.dataAto}</p>
              </div>
             )}
             {ato.destinatario.dataJuntada && (
              <div>
               <span className="font-medium text-theme-text-primary">Data da Juntada:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.dataJuntada}</p>
              </div>
             )}
             {ato.destinatario.paginaJuntadaAto && (
              <div>
               <span className="font-medium text-theme-text-primary">Página da Juntada:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.paginaJuntadaAto}</p>
              </div>
             )}
             {ato.destinatario.pagina && (
              <div>
               <span className="font-medium text-theme-text-primary">Página:</span>
               <p className="text-gray-900 dark:text-gray-100 mt-0.5">{ato.destinatario.pagina}</p>
              </div>
             )}
            </div>

            {ato.destinatario.notas && (
             <div className="mt-3 pt-3 border-t border-slate-300 dark:border-theme-border">
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Notas</span>
              <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
               {ato.destinatario.notas}
              </p>
             </div>
            )}
           </div>
          )}
         </div>

         {/* Detalhes do AR */}
         {ato.detalhesAR && (
          <div className="bg-amber-50 dark:bg-gray-700/30 rounded-lg p-4 border border-theme-border">
           <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide mb-3">
            Detalhes do Aviso de Recebimento (AR)
           </h4>

           <div className="space-y-2 text-sm">
            {ato.detalhesAR.nomeManuscrito && (
             <div>
              <span className="font-medium text-theme-text-primary">Nome Manuscrito:</span>
              <p className="text-theme-text-primary mt-0.5">{ato.detalhesAR.nomeManuscrito}</p>
             </div>
            )}
            {ato.detalhesAR.assinaturaPresente && (
             <div>
              <span className="font-medium text-theme-text-primary">Assinatura Presente:</span>
              <p className="text-theme-text-primary mt-0.5">{ato.detalhesAR.assinaturaPresente}</p>
             </div>
            )}
            {ato.detalhesAR.motivoDevolucaoExistente && (
             <div>
              <span className="font-medium text-theme-text-primary">Motivo de Devolução Existente:</span>
              <p className="text-theme-text-primary mt-0.5">{ato.detalhesAR.motivoDevolucaoExistente}</p>
             </div>
            )}
            {isNonEmptyArray(ato.detalhesAR.motivoDevolucaoIndicado) && (
             <div>
              <span className="font-medium text-theme-text-primary">Motivos de Devolução:</span>
              <ul className="list-disc list-inside text-theme-text-primary mt-0.5 space-y-1">
               {ato.detalhesAR.motivoDevolucaoIndicado.map((motivo, idx) => (
                <li key={idx}>{motivo}</li>
               ))}
              </ul>
             </div>
            )}
            {ato.detalhesAR.notas && (
             <div className="mt-2 pt-2 border-t border-amber-200 dark:border-theme-border">
              <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Notas</span>
              <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
               {ato.detalhesAR.notas}
              </p>
             </div>
            )}
           </div>
          </div>
         )}

         {/* Prazos Derivados */}
         {isNonEmptyArray(ato.prazosDerivados) && (
          <div className="space-y-3">
           <h4 className="text-sm font-semibold text-theme-text-primary uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Prazos Derivados
           </h4>

           {ato.prazosDerivados.map((prazo, pIndex) => (
            <div
             key={prazo.id}
             className="bg-blue-50 dark:bg-gray-700/30 rounded-lg p-4 border border-blue-200 dark:border-theme-border"
            >
             <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
               <div className="flex items-center gap-2 flex-wrap">
                <h5 className="font-semibold text-theme-text-primary">
                 Prazo {pIndex + 1}: {prazo.tipoPrazo}
                </h5>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(prazo.status)}`}>
                 {prazo.status}
                </span>
               </div>

               <div>
                <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Finalidade</span>
                <p className="text-sm text-theme-text-primary mt-1">{prazo.finalidade}</p>
               </div>

               {prazo.baseLegal && (
                <div>
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Base Legal</span>
                 <p className="text-sm text-theme-text-primary mt-1">{prazo.baseLegal}</p>
                </div>
               )}

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                {prazo.dataInicio && (
                 <div>
                  <span className="font-medium text-theme-text-primary">Data de Início:</span>
                  <p className="text-gray-900 dark:text-gray-100 mt-0.5">{prazo.dataInicio}</p>
                 </div>
                )}
                {prazo.duracao && (
                 <div>
                  <span className="font-medium text-theme-text-primary">Duração:</span>
                  <p className="text-gray-900 dark:text-gray-100 mt-0.5">{prazo.duracao}</p>
                 </div>
                )}
                {prazo.dataFinal && (
                 <div>
                  <span className="font-medium text-theme-text-primary">Data Final:</span>
                  <p className="text-gray-900 dark:text-gray-100 mt-0.5">{prazo.dataFinal}</p>
                 </div>
                )}
               </div>

               {prazo.observacoes && (
                <div className="mt-2 pt-3 border-t border-blue-200 dark:border-theme-border">
                 <span className="text-xs font-semibold text-theme-text-primary uppercase tracking-wide">Observações</span>
                 <p className="text-sm text-theme-text-primary mt-1 leading-relaxed">
                  {prazo.observacoes}
                 </p>
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
      ))}
     </div>
    </div>
   ))}
  </div>
 );
}
