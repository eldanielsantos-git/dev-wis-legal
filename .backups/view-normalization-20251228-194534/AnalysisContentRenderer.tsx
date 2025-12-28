import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeColors } from '../utils/themeUtils';
import { sanitizeContent, isValidParsedObject } from '../utils/jsonSanitizer';

interface AnalysisContentRendererProps {
  content: string;
}

/**
 * AnalysisContentRenderer Component
 *
 * Componente universal para renderizar conteúdo de análises forenses de forma formatada e legível.
 * GARANTE que nenhum JSON seja exibido em formato bruto para o usuário.
 *
 * Funcionalidades:
 * - Detecta AGRESSIVAMENTE qualquer conteúdo JSON (objetos e arrays)
 * - Suporta markdown com títulos (# ## ###), listas e texto formatado
 * - Renderiza arrays de objetos complexos com numeração e bordas visuais
 * - Formata listas de strings com bullets e espaçamento adequado
 * - Formata objetos aninhados com hierarquia visual clara e bordas laterais
 * - Converte nomes de campos (snake_case, camelCase) para formato legível
 * - Adapta-se ao tema claro/escuro automaticamente
 * - Preserva quebras de linha e formatação de texto
 *
 * Detecção Automática:
 * 1. JSON com marcadores ```json ou ```
 * 2. Objetos iniciando com { e terminando com }
 * 3. Arrays iniciando com [ e terminando com ]
 *
 * Formatação de Arrays:
 * - Arrays de objetos: badges numerados + bordas laterais
 * - Arrays de strings: bullets + texto formatado
 * - Arrays mistos: bullets padrão
 *
 * Formatação de Objetos:
 * - Campos vazios: ocultados automaticamente
 * - Nomes de campos: convertidos para título legível
 * - Níveis aninhados: bordas laterais coloridas
 * - Hierarquia: tamanhos de fonte diferenciados
 *
 * Uso:
 * <AnalysisContentRenderer content={analysisResult.result_content} />
 *
 * Este componente é usado para exibir TODOS os resultados de análise:
 * - Visão Geral do Processo
 * - Resumo Estratégico
 * - Comunicações e Prazos
 * - Admissibilidade Recursal
 * - Estratégias Jurídicas Recomendadas
 * - Riscos e Alertas Processuais (corrigido!)
 * - Balanço Financeiro e Créditos Processuais
 * - Mapa de Preclusões Processuais
 * - Conclusões e Perspectivas Processuais
 * - Análise completa
 * - Respostas do chat com processo
 *
 * GARANTIA: Nenhum JSON será exibido em formato bruto, independentemente do formato de entrada.
 */

export function AnalysisContentRenderer({ content }: AnalysisContentRendererProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const textColor = theme === 'dark' ? '#FAFAFA' : colors.textPrimary;

  const parseContent = (text: string) => {
    // SISTEMA DE SANITIZAÇÃO COM MÚLTIPLAS CAMADAS
    const result = sanitizeContent(text);

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AnalysisContentRenderer] Sanitization result:', {
        isJSON: result.isJSON,
        method: result.method,
        hasContent: result.cleaned.length > 0
      });
    }

    // Se foi identificado como JSON e parseado com sucesso
    if (result.isJSON && result.parsed && isValidParsedObject(result.parsed)) {
      return result.parsed;
    }

    // Se é JSON mas falhou o parse, ou se foi limpo agressivamente
    // Retornar o texto limpo
    return result.cleaned;
  };

  const renderValue = (value: any, level: number = 0): JSX.Element => {
    if (value === null || value === undefined) {
      return <span style={{ color: colors.textSecondary }}>-</span>;
    }

    if (typeof value === 'string') {
      if (value.trim() === '') {
        return <span style={{ color: colors.textSecondary }}>-</span>;
      }
      return (
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere"
          style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {value}
        </p>
      );
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span style={{ color: textColor }}>{String(value)}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span style={{ color: colors.textSecondary }}>Nenhum item</span>;
      }

      const hasComplexItems = value.some(item => typeof item === 'object' && !Array.isArray(item));
      const allStrings = value.every(item => typeof item === 'string');

      if (hasComplexItems) {
        return (
          <div className="space-y-4">
            {value.map((item, index) => (
              <div
                key={index}
                className="pl-1 pb-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      color: colors.textSecondary
                    }}
                  >
                    {index + 1}
                  </span>
                </div>
                <div>{renderValue(item, level + 1)}</div>
              </div>
            ))}
          </div>
        );
      }

      if (allStrings) {
        return (
          <ul className="space-y-1.5 ml-0">
            {value.map((item, index) => (
              <li key={index} className="flex items-start space-x-2.5">
                <span
                  className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.textSecondary }}
                />
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap break-words flex-1"
                  style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                  {item}
                </p>
              </li>
            ))}
          </ul>
        );
      }

      return (
        <ul className="space-y-2 ml-0">
          {value.map((item, index) => (
            <li key={index} className="flex items-start space-x-2">
              <span
                className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colors.textSecondary }}
              />
              <div className="flex-1">{renderValue(item, level + 1)}</div>
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className={level > 0 ? 'space-y-3' : 'space-y-4'}>
          {Object.entries(value).map(([key, val]) => {
            const formattedKey = key
              .replace(/_/g, ' ')
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
              .replace(/^\d+\.\s*/, ''); // Remove numeração do início (ex: "1. ")

            const isEmpty =
              val === null ||
              val === undefined ||
              (typeof val === 'string' && val.trim() === '') ||
              (Array.isArray(val) && val.length === 0) ||
              (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0);

            if (isEmpty) {
              return null;
            }

            const isComplexValue = typeof val === 'object';

            return (
              <div
                key={key}
                className={level > 0 && isComplexValue ? 'pl-1' : ''}
              >
                <h4
                  className={`${level === 0 ? 'font-semibold text-base' : 'font-normal text-xs'} mb-2`}
                  style={{ color: level === 0 ? '#1C9BF1' : textColor }}
                >
                  {formattedKey}
                </h4>
                <div className={isComplexValue ? 'ml-0' : 'ml-0'}>{renderValue(val, level + 1)}</div>
              </div>
            );
          })}
        </div>
      );
    }

    return <span style={{ color: textColor }}>{String(value)}</span>;
  };

  const parsedContent = parseContent(content);

  if (typeof parsedContent === 'string') {
    const lines = parsedContent.split('\n');
    const formattedLines: JSX.Element[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        formattedLines.push(<div key={index} className="h-2" />);
        return;
      }

      const cleanText = (text: string) => {
        return text
          .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove negrito
          .replace(/\*(.+?)\*/g, '$1')       // Remove itálico
          .replace(/`(.+?)`/g, '$1')         // Remove código inline
          .replace(/~~(.+?)~~/g, '$1')       // Remove tachado
          .replace(/\{/g, '')                // Remove chaves soltas
          .replace(/\}/g, '')                // Remove chaves soltas
          .replace(/\[(?!\d)/g, '')          // Remove colchetes soltos (exceto listas numeradas [1])
          .replace(/\]/g, '')                // Remove colchetes soltos
          .replace(/"/g, '')                 // Remove aspas soltas
          .replace(/,\s*$/gm, '')            // Remove vírgulas no final de linha
          .replace(/:\s*$/gm, '')            // Remove dois pontos no final de linha
          .trim();
      };

      if (trimmedLine.startsWith('# ')) {
        formattedLines.push(
          <h2
            key={index}
            className="text-xl font-bold mt-6 mb-3"
            style={{ color: textColor }}
          >
            {cleanText(trimmedLine.replace('# ', ''))}
          </h2>
        );
      } else if (trimmedLine.startsWith('## ')) {
        formattedLines.push(
          <h3
            key={index}
            className="text-sm font-semibold mt-4 mb-2"
            style={{ color: '#1C9BF1' }}
          >
            {cleanText(trimmedLine.replace('## ', ''))}
          </h3>
        );
      } else if (trimmedLine.startsWith('### ')) {
        formattedLines.push(
          <h4
            key={index}
            className="text-base font-semibold mt-3 mb-2"
            style={{ color: textColor }}
          >
            {cleanText(trimmedLine.replace('### ', ''))}
          </h4>
        );
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        formattedLines.push(
          <div key={index} className="flex items-start space-x-2 mb-1">
            <span
              className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: colors.textSecondary }}
            />
            <p
              className="text-sm leading-relaxed break-words flex-1"
              style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {cleanText(trimmedLine.replace(/^[-*]\s/, ''))}
            </p>
          </div>
        );
      } else if (/^\d+\.\s/.test(trimmedLine)) {
        const match = trimmedLine.match(/^(\d+)\.\s(.+)$/);
        if (match) {
          formattedLines.push(
            <div key={index} className="flex items-start space-x-2 mb-1">
              <span
                className="flex-shrink-0 font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {match[1]}.
              </span>
              <p
                className="text-sm leading-relaxed break-words flex-1"
                style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {cleanText(match[2])}
              </p>
            </div>
          );
        }
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        formattedLines.push(
          <p
            key={index}
            className="font-bold text-sm mb-2"
            style={{ color: textColor }}
          >
            {cleanText(trimmedLine.replace(/\*\*/g, ''))}
          </p>
        );
      } else {
        formattedLines.push(
          <p
            key={index}
            className="text-sm leading-relaxed break-words mb-2"
            style={{ color: textColor, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {cleanText(line)}
          </p>
        );
      }
    });

    return <div className="space-y-1">{formattedLines}</div>;
  }

  return <div className="space-y-4">{renderValue(parsedContent)}</div>;
}
