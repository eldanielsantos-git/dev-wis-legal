import { aggressiveClean, tryParseJSON } from './jsonSanitizer';
import { validateAndSanitizeJson } from './jsonValidator';

export interface NormalizationResult<T> {
  success: boolean;
  data: T | null;
  method: 'direct' | 'flexible-key' | 'array-extraction' | 'fallback';
  originalKeys?: string[];
}

export function cleanAndParseJson(content: string): { parsed: any; success: boolean } {
  if (!content || typeof content !== 'string') {
    return { parsed: null, success: false };
  }

  const validation = validateAndSanitizeJson(content);
  if (validation.isValid && validation.sanitizedContent) {
    try {
      return { parsed: JSON.parse(validation.sanitizedContent), success: true };
    } catch {
    }
  }

  const cleaned = aggressiveClean(content);
  const parsed = tryParseJSON(cleaned);

  if (parsed !== null) {
    return { parsed, success: true };
  }

  return { parsed: null, success: false };
}

export function findRootData(parsed: any, candidateKeys: string[]): { data: any; foundKey: string | null } {
  if (!parsed || typeof parsed !== 'object') {
    return { data: null, foundKey: null };
  }

  for (const key of candidateKeys) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      return { data: parsed[key], foundKey: key };
    }
  }

  const parsedKeys = Object.keys(parsed);
  for (const key of parsedKeys) {
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
    for (const candidate of candidateKeys) {
      const lowerCandidate = candidate.toLowerCase().replace(/[_-]/g, '');
      if (lowerKey.includes(lowerCandidate) || lowerCandidate.includes(lowerKey)) {
        return { data: parsed[key], foundKey: key };
      }
    }
  }

  if (parsedKeys.length === 1) {
    const singleKey = parsedKeys[0];
    const value = parsed[singleKey];
    if (typeof value === 'object' && value !== null) {
      return { data: value, foundKey: singleKey };
    }
  }

  return { data: null, foundKey: null };
}

export function findArrayBySignature(obj: any, fieldSignatures: string[][]): any[] | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  const searchForArray = (current: any, depth: number = 0): any[] | null => {
    if (depth > 5) return null;

    if (Array.isArray(current)) {
      if (current.length > 0) {
        const firstItem = current[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          const itemKeys = Object.keys(firstItem).map(k => k.toLowerCase());

          for (const signature of fieldSignatures) {
            const matchCount = signature.filter(sig =>
              itemKeys.some(k => k.includes(sig.toLowerCase()) || sig.toLowerCase().includes(k))
            ).length;

            if (matchCount >= Math.ceil(signature.length * 0.5)) {
              return current;
            }
          }
        }
        return current;
      }
      return null;
    }

    if (typeof current === 'object' && current !== null) {
      for (const key of Object.keys(current)) {
        const value = current[key];
        const result = searchForArray(value, depth + 1);
        if (result) return result;
      }
    }

    return null;
  };

  return searchForArray(obj);
}

export function extractAnyValidData(parsed: any): { data: any; type: 'object' | 'array' | 'primitive' | null } {
  if (!parsed) {
    return { data: null, type: null };
  }

  if (Array.isArray(parsed)) {
    return { data: parsed, type: 'array' };
  }

  if (typeof parsed === 'object') {
    return { data: parsed, type: 'object' };
  }

  if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
    return { data: parsed, type: 'primitive' };
  }

  return { data: null, type: null };
}

interface ComunicacoesExpectedStructure {
  comunicacoesPrazos: {
    titulo: string;
    secoes: Array<{
      id: string;
      titulo: string;
      listaAtos: any[];
    }>;
  };
}

export function normalizeComunicacoesPrazos(content: string): NormalizationResult<ComunicacoesExpectedStructure> {
  const { parsed, success } = cleanAndParseJson(content);

  if (!success || !parsed) {
    return { success: false, data: null, method: 'fallback' };
  }

  if (parsed.atosProcessuais?.listaAtosComunicacao && Array.isArray(parsed.atosProcessuais.listaAtosComunicacao)) {
    const normalizedAtos = parsed.atosProcessuais.listaAtosComunicacao.map((ato: any) => normalizeAtoFromRootFormat(ato));
    const normalizedData: ComunicacoesExpectedStructure = {
      comunicacoesPrazos: {
        titulo: 'Analise de Comunicacoes e Prazos Processuais',
        secoes: [{
          id: 'secao_principal',
          titulo: parsed.atosProcessuais.focoPrincipal || 'Citacoes, Intimacoes e Notificacoes',
          listaAtos: normalizedAtos
        }]
      }
    };
    return {
      success: true,
      data: normalizedData,
      method: 'array-extraction',
      originalKeys: Object.keys(parsed)
    };
  }

  if (parsed.atosComunicacao && Array.isArray(parsed.atosComunicacao) && parsed.atosComunicacao.length > 0) {
    const normalizedAtos = parsed.atosComunicacao.map((ato: any) => normalizeAtoFromRootFormat(ato));
    const normalizedData: ComunicacoesExpectedStructure = {
      comunicacoesPrazos: {
        titulo: 'Analise de Comunicacoes e Prazos Processuais',
        secoes: [{
          id: 'secao_principal',
          titulo: 'Citacoes, Intimacoes e Notificacoes',
          listaAtos: normalizedAtos
        }]
      }
    };
    return {
      success: true,
      data: normalizedData,
      method: 'array-extraction',
      originalKeys: Object.keys(parsed)
    };
  }

  const candidateKeys = [
    'comunicacoesPrazos',
    'comunicacoes_prazos',
    'comunicacoesEPrazos',
    'comunicacoes',
    'atosProcessuais',
    'dados',
    'resultado',
    'output',
    'data'
  ];

  const { data: rootData, foundKey } = findRootData(parsed, candidateKeys);

  if (rootData && foundKey === 'comunicacoesPrazos') {
    if (rootData.secoes && Array.isArray(rootData.secoes)) {
      return {
        success: true,
        data: { comunicacoesPrazos: rootData },
        method: 'direct',
        originalKeys: Object.keys(parsed)
      };
    }

    if (rootData.atosComunicacao && Array.isArray(rootData.atosComunicacao)) {
      const normalizedAtos = rootData.atosComunicacao.map((ato: any) => normalizeAtoFromRootFormat(ato));
      const normalizedData: ComunicacoesExpectedStructure = {
        comunicacoesPrazos: {
          titulo: rootData.titulo || 'Comunicacoes e Prazos',
          secoes: [{
            id: 'secao_principal',
            titulo: 'Citacoes e Intimacoes',
            listaAtos: normalizedAtos
          }]
        }
      };
      return {
        success: true,
        data: normalizedData,
        method: 'flexible-key',
        originalKeys: Object.keys(parsed)
      };
    }
  }

  if (rootData) {
    const arraySignatures = [
      ['tipoAto', 'destinatario', 'modalidade'],
      ['tipo', 'destinatario', 'data'],
      ['ato', 'prazo', 'status']
    ];

    const foundArray = findArrayBySignature(rootData, arraySignatures);

    if (foundArray && foundArray.length > 0) {
      const normalizedAtos = foundArray.map((ato: any) => normalizeAtoFromRootFormat(ato));
      const normalizedData: ComunicacoesExpectedStructure = {
        comunicacoesPrazos: {
          titulo: rootData.titulo || 'Comunicacoes e Prazos',
          secoes: [{
            id: 'secao_extraida',
            titulo: 'Atos de Comunicacao',
            listaAtos: normalizedAtos
          }]
        }
      };
      return {
        success: true,
        data: normalizedData,
        method: 'array-extraction',
        originalKeys: Object.keys(parsed)
      };
    }

    if (rootData.secoes || rootData.atosComunicacao || rootData.atos || rootData.listaAtos) {
      const atos = rootData.secoes?.[0]?.listaAtos ||
                   rootData.atosComunicacao ||
                   rootData.atos ||
                   rootData.listaAtos ||
                   [];

      if (Array.isArray(atos) && atos.length > 0) {
        const normalizedAtos = atos.map((ato: any) => normalizeAtoFromRootFormat(ato));
        const normalizedData: ComunicacoesExpectedStructure = {
          comunicacoesPrazos: {
            titulo: rootData.titulo || 'Comunicacoes e Prazos',
            secoes: [{
              id: 'secao_normalizada',
              titulo: rootData.secoes?.[0]?.titulo || 'Atos',
              listaAtos: normalizedAtos
            }]
          }
        };
        return {
          success: true,
          data: normalizedData,
          method: 'flexible-key',
          originalKeys: Object.keys(parsed)
        };
      }
    }
  }

  return {
    success: false,
    data: null,
    method: 'fallback',
    originalKeys: Object.keys(parsed || {})
  };
}

function normalizeAtoFromRootFormat(atoRaw: any): any {
  const destinatario = atoRaw.destinatario || {};
  const datasRelevantes = atoRaw.datasRelevantes || {};
  const statusAtoObj = atoRaw.statusAto || {};

  const extractStatus = (statusData: any): string => {
    if (!statusData) return 'Status nao identificado';
    if (typeof statusData === 'string') return statusData;
    if (typeof statusData === 'object' && statusData.status) return statusData.status;
    return 'Status nao identificado';
  };

  return {
    id: atoRaw.id || `ato_${Math.random().toString(36).substr(2, 9)}`,
    tipoAto: atoRaw.tipoAto || atoRaw.tipo || 'Tipo nao identificado',
    modalidade: atoRaw.modalidade || 'Modalidade nao identificada',
    destinatario: {
      nome: destinatario.nome || 'Destinatario nao identificado',
      documento: destinatario.documento || destinatario.cpf || destinatario.cnpj,
      tipo: destinatario.qualificacao || destinatario.tipo || 'Tipo nao identificado',
      status: extractStatus(atoRaw.statusAto),
      dataAto: datasRelevantes.dataAto || atoRaw.datas?.ato || atoRaw.dataAto,
      dataJuntada: datasRelevantes.dataJuntada || atoRaw.datas?.juntada || atoRaw.dataJuntada,
      paginaJuntadaAto: datasRelevantes.referenciaArquivoPagina?.certidaoCumprimento || atoRaw.referenciaDocumental?.pagina || atoRaw.pagina,
      notas: atoRaw.notasGerais || atoRaw.notas || (typeof statusAtoObj === 'object' ? statusAtoObj.detalhes : undefined)
    },
    validadeStatus: extractStatus(atoRaw.statusAto),
    dataAto: datasRelevantes.dataAto || atoRaw.datas?.ato || atoRaw.dataAto,
    dataJuntada: datasRelevantes.dataJuntada || atoRaw.datas?.juntada || atoRaw.dataJuntada,
    referencia: (datasRelevantes.referenciaArquivoPagina || atoRaw.referenciaDocumental) ? {
      arquivo: datasRelevantes.referenciaArquivoPagina?.mandado || atoRaw.referenciaDocumental?.comprovante || atoRaw.referenciaDocumental?.instrumento,
      paginas: datasRelevantes.referenciaArquivoPagina?.certidaoCumprimento || atoRaw.referenciaDocumental?.pagina
    } : undefined,
    notas: atoRaw.notasGerais || atoRaw.notas,
    prazosDerivados: Array.isArray(atoRaw.prazos) ? atoRaw.prazos.map((prazo: any) => ({
      id: prazo.idPrazo || prazo.id || `prazo_${Math.random().toString(36).substr(2, 9)}`,
      tipoPrazo: prazo.tipoPrazo || prazo.tipo || 'Prazo',
      finalidade: prazo.finalidade || '',
      baseLegal: prazo.baseLegal,
      dataInicio: prazo.termoInicial?.data || prazo.termoInicial || prazo.dataInicio,
      duracao: prazo.duracao?.valor ? `${prazo.duracao.valor} ${prazo.duracao.unidade || 'dias'}` : (prazo.duracaoLegal || prazo.duracao),
      dataFinal: prazo.termoFinal?.data || prazo.termoFinal || prazo.dataFinal,
      status: prazo.statusPrazo || prazo.statusJuridico || prazo.status || 'Status nao identificado',
      observacoes: prazo.notas || prazo.observacoes
    })) : undefined
  };
}

interface RiscosExpectedStructure {
  riscosAlertasProcessuais: {
    titulo: string;
    secoes: Array<{
      id: string;
      titulo: string;
      listaAlertas?: any[];
      campos?: any[];
    }>;
  };
}

export function normalizeRiscosAlertas(content: string): NormalizationResult<RiscosExpectedStructure> {
  const { parsed, success } = cleanAndParseJson(content);

  if (!success || !parsed) {
    return { success: false, data: null, method: 'fallback' };
  }

  const candidateKeys = [
    'riscosAlertasProcessuais',
    'riscos_alertas_processuais',
    'riscosAlertas',
    'riscos_alertas',
    'riscos',
    'alertas',
    'dados',
    'resultado',
    'output'
  ];

  const { data: rootData, foundKey } = findRootData(parsed, candidateKeys);

  if (rootData && foundKey === 'riscosAlertasProcessuais') {
    if (rootData.secoes && Array.isArray(rootData.secoes)) {
      return {
        success: true,
        data: { riscosAlertasProcessuais: rootData },
        method: 'direct',
        originalKeys: Object.keys(parsed)
      };
    }
  }

  if (rootData) {
    const arraySignatures = [
      ['categoria', 'descricaoRisco', 'gravidade'],
      ['categoria', 'descricao', 'gravidade'],
      ['tipo', 'risco', 'impacto'],
      ['alerta', 'urgencia', 'acao']
    ];

    const foundArray = findArrayBySignature(rootData, arraySignatures);

    if (foundArray && foundArray.length > 0) {
      const normalizedData: RiscosExpectedStructure = {
        riscosAlertasProcessuais: {
          titulo: rootData.titulo || 'Riscos e Alertas Processuais',
          secoes: [{
            id: 'secao_extraida',
            titulo: 'Alertas Identificados',
            listaAlertas: foundArray
          }]
        }
      };
      return {
        success: true,
        data: normalizedData,
        method: 'array-extraction',
        originalKeys: Object.keys(parsed)
      };
    }

    if (rootData.secoes || rootData.listaAlertas || rootData.alertas) {
      const alertas = rootData.secoes?.[0]?.listaAlertas ||
                      rootData.listaAlertas ||
                      rootData.alertas ||
                      [];

      if (Array.isArray(alertas)) {
        const normalizedData: RiscosExpectedStructure = {
          riscosAlertasProcessuais: {
            titulo: rootData.titulo || 'Riscos e Alertas Processuais',
            secoes: [{
              id: 'secao_normalizada',
              titulo: rootData.secoes?.[0]?.titulo || 'Alertas',
              listaAlertas: alertas,
              campos: rootData.secoes?.[0]?.campos || rootData.campos
            }]
          }
        };
        return {
          success: true,
          data: normalizedData,
          method: 'flexible-key',
          originalKeys: Object.keys(parsed)
        };
      }
    }
  }

  return {
    success: false,
    data: null,
    method: 'fallback',
    originalKeys: Object.keys(parsed || {})
  };
}

export function normalizeGenericView(content: string, expectedRootKey: string, candidateKeys: string[]): NormalizationResult<any> {
  const { parsed, success } = cleanAndParseJson(content);

  if (!success || !parsed) {
    return { success: false, data: null, method: 'fallback' };
  }

  const allCandidates = [expectedRootKey, ...candidateKeys];
  const { data: rootData, foundKey } = findRootData(parsed, allCandidates);

  if (rootData) {
    const result: any = {};
    result[expectedRootKey] = rootData;

    return {
      success: true,
      data: result,
      method: foundKey === expectedRootKey ? 'direct' : 'flexible-key',
      originalKeys: Object.keys(parsed)
    };
  }

  return {
    success: false,
    data: null,
    method: 'fallback',
    originalKeys: Object.keys(parsed || {})
  };
}
