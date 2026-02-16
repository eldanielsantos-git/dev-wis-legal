import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PDFColors {
  background: { r: number; g: number; b: number };
  cardBg: { r: number; g: number; b: number };
  cardBgTertiary: { r: number; g: number; b: number };
  textPrimary: { r: number; g: number; b: number };
  textSecondary: { r: number; g: number; b: number };
  border: { r: number; g: number; b: number };
  blue: { r: number; g: number; b: number };
  green: { r: number; g: number; b: number };
  red: { r: number; g: number; b: number };
  amber: { r: number; g: number; b: number };
  purple: { r: number; g: number; b: number };
  slate: { r: number; g: number; b: number };
}

const PDF_COLORS: PDFColors = {
  background: { r: 250 / 255, g: 250 / 255, b: 250 / 255 },
  cardBg: { r: 255 / 255, g: 255 / 255, b: 255 / 255 },
  cardBgTertiary: { r: 248 / 255, g: 250 / 255, b: 252 / 255 },
  textPrimary: { r: 15 / 255, g: 14 / 255, b: 13 / 255 },
  textSecondary: { r: 107 / 255, g: 114 / 255, b: 128 / 255 },
  border: { r: 229 / 255, g: 231 / 255, b: 235 / 255 },
  blue: { r: 59 / 255, g: 130 / 255, b: 246 / 255 },
  green: { r: 34 / 255, g: 197 / 255, b: 94 / 255 },
  red: { r: 239 / 255, g: 68 / 255, b: 68 / 255 },
  amber: { r: 245 / 255, g: 158 / 255, b: 11 / 255 },
  purple: { r: 168 / 255, g: 85 / 255, b: 247 / 255 },
  slate: { r: 100 / 255, g: 116 / 255, b: 139 / 255 },
};

const LOGO_URL = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/wislegal-logo-PDF-white.png';

const CARD_PADDING = 18;
const CARD_INNER_SPACING = 10;
const LINE_HEIGHT_MULTIPLIER = 1.5;
const SECTION_SPACING = 28;
const SUBSECTION_SPACING = 18;
const CARD_SPACING = 14;

interface RenderContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  yPosition: number;
  colors: PDFColors;
  fonts: { regular: PDFFont; bold: PDFFont; title: PDFFont };
  margin: number;
  pageWidth: number;
  pageHeight: number;
}

interface TextMeasurement {
  lines: string[];
  totalHeight: number;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    return null;
  }
}

function parseContent(content: string): any {
  try {
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```\s*$/i, '');
    cleaned = cleaned.trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function measureText(text: string, font: PDFFont, fontSize: number, maxWidth: number): TextMeasurement {
  if (!text || text.trim() === '') {
    return { lines: [], totalHeight: 0 };
  }

  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
  const totalHeight = lines.length * lineHeight;

  return { lines, totalHeight };
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: { r: number; g: number; b: number },
  borderColor?: { r: number; g: number; b: number },
  borderWidth: number = 1,
  borderLeft: boolean = false,
  borderLeftColor?: { r: number; g: number; b: number }
): void {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(color.r, color.g, color.b),
    borderColor: borderColor ? rgb(borderColor.r, borderColor.g, borderColor.b) : undefined,
    borderWidth: borderColor ? borderWidth : 0,
  });

  if (borderLeft && borderLeftColor) {
    page.drawRectangle({
      x,
      y,
      width: 5,
      height,
      color: rgb(borderLeftColor.r, borderLeftColor.g, borderLeftColor.b),
    });
  }
}

function drawTextBlock(
  ctx: RenderContext,
  text: string,
  x: number,
  startY: number,
  options: {
    size: number;
    font?: PDFFont;
    color?: { r: number; g: number; b: number };
    maxWidth: number;
  }
): number {
  const font = options.font || ctx.fonts.regular;
  const color = options.color || ctx.colors.textPrimary;
  const measurement = measureText(text, font, options.size, options.maxWidth);

  let currentY = startY;
  const lineHeight = options.size * LINE_HEIGHT_MULTIPLIER;

  for (const line of measurement.lines) {
    ctx.page.drawText(line, {
      x,
      y: currentY,
      size: options.size,
      font,
      color: rgb(color.r, color.g, color.b),
    });
    currentY -= lineHeight;
  }

  return currentY;
}

function drawSectionHeader(ctx: RenderContext, title: string): RenderContext {
  ctx.page.drawText(normalizeText(title), {
    x: ctx.margin,
    y: ctx.yPosition,
    size: 20,
    font: ctx.fonts.bold,
    color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
  });

  ctx.yPosition -= 28;

  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.yPosition },
    end: { x: ctx.pageWidth - ctx.margin, y: ctx.yPosition },
    thickness: 2,
    color: rgb(ctx.colors.border.r, ctx.colors.border.g, ctx.colors.border.b),
  });

  ctx.yPosition -= SECTION_SPACING;
  return ctx;
}

function drawSubsectionTitle(
  ctx: RenderContext,
  title: string,
  color?: { r: number; g: number; b: number }
): RenderContext {
  ctx.page.drawText(normalizeText(title), {
    x: ctx.margin,
    y: ctx.yPosition,
    size: 15,
    font: ctx.fonts.bold,
    color: rgb(
      (color || ctx.colors.blue).r,
      (color || ctx.colors.blue).g,
      (color || ctx.colors.blue).b
    ),
  });

  ctx.yPosition -= SUBSECTION_SPACING;
  return ctx;
}

function drawDynamicCard(
  ctx: RenderContext,
  content: Array<{ label?: string; value: string; type?: 'title' | 'text' }>,
  options: {
    borderColor?: { r: number; g: number; b: number };
    bgColor?: { r: number; g: number; b: number };
  } = {}
): RenderContext {
  const cardWidth = ctx.pageWidth - 2 * ctx.margin;
  const contentMaxWidth = cardWidth - 2 * CARD_PADDING - 6;
  const borderColor = options.borderColor || ctx.colors.blue;
  const bgColor = options.bgColor || ctx.colors.cardBg;

  let contentHeight = CARD_PADDING;

  const measurements: Array<{ label?: TextMeasurement; value: TextMeasurement }> = [];

  for (const item of content) {
    const itemMeasurements: { label?: TextMeasurement; value: TextMeasurement } = {
      value: { lines: [], totalHeight: 0 },
    };

    if (item.label) {
      itemMeasurements.label = measureText(item.label, ctx.fonts.bold, 9, contentMaxWidth);
      contentHeight += itemMeasurements.label.totalHeight + 4;
    }

    const fontSize = item.type === 'title' ? 12 : 9;
    const font = item.type === 'title' ? ctx.fonts.bold : ctx.fonts.regular;
    itemMeasurements.value = measureText(item.value, font, fontSize, contentMaxWidth);
    contentHeight += itemMeasurements.value.totalHeight;

    measurements.push(itemMeasurements);

    if (content.indexOf(item) < content.length - 1) {
      contentHeight += CARD_INNER_SPACING;
    }
  }

  contentHeight += CARD_PADDING;

  const cardY = ctx.yPosition - contentHeight;

  drawRoundedRect(
    ctx.page,
    ctx.margin,
    cardY,
    cardWidth,
    contentHeight,
    bgColor,
    ctx.colors.border,
    1,
    true,
    borderColor
  );

  let innerY = ctx.yPosition - CARD_PADDING;
  const innerX = ctx.margin + CARD_PADDING + 6;

  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    const measurement = measurements[i];

    if (item.label && measurement.label) {
      innerY = drawTextBlock(ctx, item.label, innerX, innerY, {
        size: 9,
        font: ctx.fonts.bold,
        color: ctx.colors.textSecondary,
        maxWidth: contentMaxWidth,
      });
      innerY -= 4;
    }

    const fontSize = item.type === 'title' ? 12 : 9;
    const font = item.type === 'title' ? ctx.fonts.bold : ctx.fonts.regular;

    innerY = drawTextBlock(ctx, item.value, innerX, innerY, {
      size: fontSize,
      font,
      color: ctx.colors.textPrimary,
      maxWidth: contentMaxWidth,
    });

    if (i < content.length - 1) {
      innerY -= CARD_INNER_SPACING;
    }
  }

  ctx.yPosition = cardY - CARD_SPACING;
  return ctx;
}

function renderFieldGrid(
  ctx: RenderContext,
  fields: Array<{ label: string; value: string }>,
  columns: number = 3
): RenderContext {
  if (!fields || fields.length === 0) return ctx;

  const gap = 12;
  const cardWidth = ctx.pageWidth - 2 * ctx.margin;
  const fieldWidth = (cardWidth - gap * (columns - 1)) / columns;
  const fieldPadding = 12;

  const processedIndices = new Set<number>();

  for (let i = 0; i < fields.length; i++) {
    if (processedIndices.has(i)) continue;

    const field = fields[i];
    const valueMeasure = measureText(String(field.value), ctx.fonts.regular, 9, fieldWidth - 2 * fieldPadding);

    if (valueMeasure.lines.length > 3) {
      const labelMeasure = measureText(field.label, ctx.fonts.bold, 8, cardWidth - 2 * fieldPadding);
      const totalContentHeight = labelMeasure.totalHeight + 6 + valueMeasure.totalHeight;
      const fieldHeight = Math.max(65, totalContentHeight + 2 * fieldPadding);

      const x = ctx.margin;
      const y = ctx.yPosition - fieldHeight;

      drawRoundedRect(ctx.page, x, y, cardWidth, fieldHeight, ctx.colors.cardBgTertiary, ctx.colors.border, 1);

      const labelY = ctx.yPosition - fieldPadding - 8;
      drawTextBlock(ctx, field.label, x + fieldPadding, labelY, {
        size: 8,
        font: ctx.fonts.bold,
        color: ctx.colors.textSecondary,
        maxWidth: cardWidth - 2 * fieldPadding,
      });

      const valueY = labelY - labelMeasure.totalHeight - 6;
      drawTextBlock(ctx, String(field.value), x + fieldPadding, valueY, {
        size: 9,
        font: ctx.fonts.regular,
        color: ctx.colors.textPrimary,
        maxWidth: cardWidth - 2 * fieldPadding,
      });

      ctx.yPosition -= fieldHeight + gap;
      processedIndices.add(i);
    } else {
      const fieldsInRow: Array<{ field: typeof field; index: number }> = [];

      for (let j = i; j < fields.length && fieldsInRow.length < columns; j++) {
        if (processedIndices.has(j)) continue;
        const f = fields[j];
        const vMeasure = measureText(String(f.value), ctx.fonts.regular, 9, fieldWidth - 2 * fieldPadding);
        if (vMeasure.lines.length <= 3) {
          fieldsInRow.push({ field: f, index: j });
        } else {
          break;
        }
      }

      if (fieldsInRow.length === 0) continue;

      const labelMeasure = measureText(field.label, ctx.fonts.bold, 8, fieldWidth - 2 * fieldPadding);
      const totalContentHeight = labelMeasure.totalHeight + 6 + valueMeasure.totalHeight;
      const fieldHeight = Math.max(65, totalContentHeight + 2 * fieldPadding);

      for (let j = 0; j < fieldsInRow.length; j++) {
        const { field: f, index } = fieldsInRow[j];
        const x = ctx.margin + j * (fieldWidth + gap);
        const y = ctx.yPosition - fieldHeight;

        drawRoundedRect(ctx.page, x, y, fieldWidth, fieldHeight, ctx.colors.cardBgTertiary, ctx.colors.border, 1);

        const lMeasure = measureText(f.label, ctx.fonts.bold, 8, fieldWidth - 2 * fieldPadding);
        const labelY = ctx.yPosition - fieldPadding - 8;

        drawTextBlock(ctx, f.label, x + fieldPadding, labelY, {
          size: 8,
          font: ctx.fonts.bold,
          color: ctx.colors.textSecondary,
          maxWidth: fieldWidth - 2 * fieldPadding,
        });

        const valueY = labelY - lMeasure.totalHeight - 6;
        drawTextBlock(ctx, String(f.value), x + fieldPadding, valueY, {
          size: 9,
          font: ctx.fonts.regular,
          color: ctx.colors.textPrimary,
          maxWidth: fieldWidth - 2 * fieldPadding,
        });

        processedIndices.add(index);
      }

      ctx.yPosition -= fieldHeight + gap;
    }
  }

  ctx.yPosition -= CARD_SPACING - gap;
  return ctx;
}

function estimateCardHeight(
  ctx: RenderContext,
  content: Array<{ label?: string; value: string; type?: 'title' | 'text' }>
): number {
  const cardWidth = ctx.pageWidth - 2 * ctx.margin;
  const contentMaxWidth = cardWidth - 2 * CARD_PADDING - 6;
  let contentHeight = CARD_PADDING;

  for (const item of content) {
    if (item.label) {
      const labelMeasure = measureText(item.label, ctx.fonts.bold, 9, contentMaxWidth);
      contentHeight += labelMeasure.totalHeight + 4;
    }

    const fontSize = item.type === 'title' ? 12 : 9;
    const font = item.type === 'title' ? ctx.fonts.bold : ctx.fonts.regular;
    const valueMeasure = measureText(item.value, font, fontSize, contentMaxWidth);
    contentHeight += valueMeasure.totalHeight;

    if (content.indexOf(item) < content.length - 1) {
      contentHeight += CARD_INNER_SPACING;
    }
  }

  contentHeight += CARD_PADDING;
  return contentHeight;
}

function estimateFieldGridHeight(
  ctx: RenderContext,
  fields: Array<{ label: string; value: string }>,
  columns: number
): number {
  if (!fields || fields.length === 0) return 0;

  const gap = 12;
  const cardWidth = ctx.pageWidth - 2 * ctx.margin;
  const fieldWidth = (cardWidth - gap * (columns - 1)) / columns;
  const fieldPadding = 12;
  let totalHeight = 0;
  let processedCount = 0;

  for (let i = 0; i < fields.length; i++) {
    if (processedCount > i) continue;

    const field = fields[i];
    const labelMeasure = measureText(field.label, ctx.fonts.bold, 8, fieldWidth - 2 * fieldPadding);
    const valueMeasure = measureText(String(field.value), ctx.fonts.regular, 9, fieldWidth - 2 * fieldPadding);

    const totalContentHeight = labelMeasure.totalHeight + 6 + valueMeasure.totalHeight;
    const fieldHeight = Math.max(65, totalContentHeight + 2 * fieldPadding);

    if (valueMeasure.lines.length > 3) {
      totalHeight += fieldHeight + gap;
      processedCount = i + 1;
    } else {
      let fieldsInRow = 1;
      for (let j = i + 1; j < fields.length && fieldsInRow < columns; j++) {
        const f = fields[j];
        const vMeasure = measureText(String(f.value), ctx.fonts.regular, 9, fieldWidth - 2 * fieldPadding);
        if (vMeasure.lines.length <= 3) {
          fieldsInRow++;
        } else {
          break;
        }
      }
      totalHeight += fieldHeight + gap;
      processedCount = i + fieldsInRow;
    }
  }

  return totalHeight;
}

function measureContentHeight(ctx: RenderContext, results: any[]): number {
  let totalHeight = 0;

  for (const result of results) {
    const data = typeof result.result_content === 'string' ? parseContent(result.result_content) : result.result_content;
    if (!data) continue;

    totalHeight += 48;
    totalHeight += SECTION_SPACING;

    if (data.visaoGeralProcesso) {
      const analysis = data.visaoGeralProcesso;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
          totalHeight += estimateFieldGridHeight(ctx, fields, 3);
        }

        if (secao.lista && secao.lista.length > 0) {
          for (const parte of secao.lista) {
            const cardContent = [
              { value: String(parte.nome || ''), type: 'title' as const },
              { label: 'CPF/CNPJ', value: parte.cpfCnpj || 'N/A' },
              { label: 'Polo', value: parte.Polo || 'N/A' },
            ];
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.resumoEstrategico) {
      const analysis = data.resumoEstrategico;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
          totalHeight += estimateFieldGridHeight(ctx, fields, 2);
        }
        totalHeight += 8;
      }
    } else if (data.comunicacoesPrazos) {
      const analysis = data.comunicacoesPrazos;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.listaAtos && secao.listaAtos.length > 0) {
          for (const ato of secao.listaAtos) {
            const cardContent = [
              { value: `Ato - ${ato.tipoAto || ''}`, type: 'title' as const },
              { label: 'Modalidade', value: ato.modalidade || 'N/A' },
            ];
            if (ato.destinatario) {
              const dest = Array.isArray(ato.destinatario) ? ato.destinatario[0] : ato.destinatario;
              cardContent.push({ label: 'Destinatario', value: `${dest?.nome || 'N/A'} - ${dest?.status || 'N/A'}` });
            }
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.recursosAdmissibilidade) {
      const analysis = data.recursosAdmissibilidade;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.listaRecursosIdentificados && secao.listaRecursosIdentificados.length > 0) {
          for (const recurso of secao.listaRecursosIdentificados) {
            const cardContent = [
              { value: `Recurso - ${recurso.tipoRecurso || ''}`, type: 'title' as const },
              { label: 'Tempestividade', value: recurso.tempestividade || 'N/A' },
              { label: 'Situacao Atual', value: recurso.situacaoAtual || 'N/A' },
            ];
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.estrategiasJuridicas) {
      const analysis = data.estrategiasJuridicas;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.listaEstrategias && secao.listaEstrategias.length > 0) {
          for (const estrategia of secao.listaEstrategias) {
            const cardContent = [{ value: estrategia.polo || 'N/A', type: 'title' as const }];
            if (estrategia.estrategiaPrincipal) {
              cardContent.push({ label: 'Estrategia Principal', value: estrategia.estrategiaPrincipal.descricao || 'N/A' });
            }
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.riscosAlertasProcessuais) {
      const analysis = data.riscosAlertasProcessuais;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.listaAlertas && secao.listaAlertas.length > 0) {
          for (const alerta of secao.listaAlertas) {
            const cardContent = [
              { value: `Alerta - ${alerta.categoria || ''}`, type: 'title' as const },
              { label: 'Gravidade', value: alerta.gravidade || 'N/A' },
              { label: 'Polo Afetado', value: alerta.poloAfetado || 'N/A' },
              { label: 'Descricao do Risco', value: alerta.descricaoRisco || 'N/A' },
            ];
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.balancoFinanceiro) {
      const analysis = data.balancoFinanceiro;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
          totalHeight += estimateFieldGridHeight(ctx, fields, 2);
        }
        if (secao.listaHonorarios && secao.listaHonorarios.length > 0) {
          for (const hon of secao.listaHonorarios) {
            const cardContent = [
              { value: `Honorario - ${hon.tipo || ''}`, type: 'title' as const },
              { label: 'Valor Estimado', value: hon.valorEstimado || 'N/A' },
              { label: 'Polo Beneficiado', value: hon.poloBeneficiado || 'N/A' },
            ];
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.mapaPreclusoesProcessuais) {
      const analysis = data.mapaPreclusoesProcessuais;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.listaPreclusoesRecentes && secao.listaPreclusoesRecentes.length > 0) {
          for (const prec of secao.listaPreclusoesRecentes) {
            const cardContent = [
              { value: `Preclusao - ${prec.tipo || ''}`, type: 'title' as const },
              { label: 'Polo Afetado', value: prec.poloAfetado || 'N/A' },
              { label: 'Ato ou Fase Atingida', value: prec.atoOuFaseAtingida || 'N/A' },
            ];
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    } else if (data.conclusoesPerspectivas) {
      const analysis = data.conclusoesPerspectivas;
      for (const secao of analysis.secoes || []) {
        totalHeight += 33 + SUBSECTION_SPACING;
        if (secao.campos && secao.campos.length > 0) {
          for (const campo of secao.campos) {
            if (campo.label) totalHeight += 33 + SUBSECTION_SPACING;
            const cardContent = [];
            if (Array.isArray(campo.valor)) {
              for (const item of campo.valor) {
                cardContent.push({ value: `- ${item}` });
              }
            } else {
              cardContent.push({ value: String(campo.valor) });
            }
            totalHeight += estimateCardHeight(ctx, cardContent) + CARD_SPACING;
          }
        }
        totalHeight += 8;
      }
    }

    totalHeight += 16;
  }

  return totalHeight + 50;
}

function renderAnalysisContent(ctx: RenderContext, result: any): RenderContext {
  const data = typeof result.result_content === 'string' ? parseContent(result.result_content) : result.result_content;
  if (!data) return ctx;

  ctx = drawSectionHeader(ctx, result.prompt_title);

  if (data.visaoGeralProcesso) {
    const analysis = data.visaoGeralProcesso;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);

      if (secao.campos && secao.campos.length > 0) {
        const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
        ctx = renderFieldGrid(ctx, fields, 3);
      }

      if (secao.lista && secao.lista.length > 0) {
        for (const parte of secao.lista) {
          const cardContent = [
            { value: String(parte.nome || ''), type: 'title' as const },
            { label: 'CPF/CNPJ', value: parte.cpfCnpj || 'N/A' },
            { label: 'Polo', value: parte.Polo || 'N/A' },
          ];
          ctx = drawDynamicCard(ctx, cardContent, { bgColor: ctx.colors.cardBgTertiary });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.resumoEstrategico) {
    const analysis = data.resumoEstrategico;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.campos && secao.campos.length > 0) {
        const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
        ctx = renderFieldGrid(ctx, fields, 2);
      }
      ctx.yPosition -= 8;
    }
  } else if (data.comunicacoesPrazos) {
    const analysis = data.comunicacoesPrazos;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.listaAtos && secao.listaAtos.length > 0) {
        for (let i = 0; i < secao.listaAtos.length; i++) {
          const ato = secao.listaAtos[i];
          const cardContent = [
            { value: `Ato ${i + 1} - ${ato.tipoAto || ''}`, type: 'title' as const },
            { label: 'Modalidade', value: ato.modalidade || 'N/A' },
          ];
          if (ato.destinatario) {
            const dest = Array.isArray(ato.destinatario) ? ato.destinatario[0] : ato.destinatario;
            cardContent.push({ label: 'Destinatario', value: `${dest?.nome || 'N/A'} - ${dest?.status || 'N/A'}` });
          }
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.blue });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.recursosAdmissibilidade) {
    const analysis = data.recursosAdmissibilidade;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.listaRecursosIdentificados && secao.listaRecursosIdentificados.length > 0) {
        for (let i = 0; i < secao.listaRecursosIdentificados.length; i++) {
          const recurso = secao.listaRecursosIdentificados[i];
          const cardContent = [
            { value: `Recurso ${i + 1} - ${recurso.tipoRecurso || ''}`, type: 'title' as const },
            { label: 'Tempestividade', value: recurso.tempestividade || 'N/A' },
            { label: 'Situacao Atual', value: recurso.situacaoAtual || 'N/A' },
          ];
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.purple });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.estrategiasJuridicas) {
    const analysis = data.estrategiasJuridicas;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.listaEstrategias && secao.listaEstrategias.length > 0) {
        for (const estrategia of secao.listaEstrategias) {
          const cardContent = [{ value: estrategia.polo || 'N/A', type: 'title' as const }];
          if (estrategia.estrategiaPrincipal) {
            cardContent.push({ label: 'Estrategia Principal', value: estrategia.estrategiaPrincipal.descricao || 'N/A' });
          }
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.green });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.riscosAlertasProcessuais) {
    const analysis = data.riscosAlertasProcessuais;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.listaAlertas && secao.listaAlertas.length > 0) {
        for (let i = 0; i < secao.listaAlertas.length; i++) {
          const alerta = secao.listaAlertas[i];
          const cardContent = [
            { value: `Alerta ${i + 1} - ${alerta.categoria || ''}`, type: 'title' as const },
            { label: 'Gravidade', value: alerta.gravidade || 'N/A' },
            { label: 'Polo Afetado', value: alerta.poloAfetado || 'N/A' },
            { label: 'Descricao do Risco', value: alerta.descricaoRisco || 'N/A' },
          ];
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.red });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.balancoFinanceiro) {
    const analysis = data.balancoFinanceiro;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo, ctx.colors.green);
      if (secao.campos && secao.campos.length > 0) {
        const fields = secao.campos.map((c: any) => ({ label: c.label || '', value: String(c.valor || '') }));
        ctx = renderFieldGrid(ctx, fields, 2);
      }
      if (secao.listaHonorarios && secao.listaHonorarios.length > 0) {
        for (let i = 0; i < secao.listaHonorarios.length; i++) {
          const hon = secao.listaHonorarios[i];
          const cardContent = [
            { value: `Honorario ${i + 1} - ${hon.tipo || ''}`, type: 'title' as const },
            { label: 'Valor Estimado', value: hon.valorEstimado || 'N/A' },
            { label: 'Polo Beneficiado', value: hon.poloBeneficiado || 'N/A' },
          ];
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.purple });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.mapaPreclusoesProcessuais) {
    const analysis = data.mapaPreclusoesProcessuais;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo, ctx.colors.amber);
      if (secao.listaPreclusoesRecentes && secao.listaPreclusoesRecentes.length > 0) {
        for (let i = 0; i < secao.listaPreclusoesRecentes.length; i++) {
          const prec = secao.listaPreclusoesRecentes[i];
          const cardContent = [
            { value: `Preclusao ${i + 1} - ${prec.tipo || ''}`, type: 'title' as const },
            { label: 'Polo Afetado', value: prec.poloAfetado || 'N/A' },
            { label: 'Ato ou Fase Atingida', value: prec.atoOuFaseAtingida || 'N/A' },
          ];
          ctx = drawDynamicCard(ctx, cardContent, { borderColor: ctx.colors.amber });
        }
      }
      ctx.yPosition -= 8;
    }
  } else if (data.conclusoesPerspectivas) {
    const analysis = data.conclusoesPerspectivas;
    for (const secao of analysis.secoes || []) {
      ctx = drawSubsectionTitle(ctx, secao.titulo);
      if (secao.campos && secao.campos.length > 0) {
        for (const campo of secao.campos) {
          if (campo.label) {
            ctx = drawSubsectionTitle(ctx, campo.label, ctx.colors.slate);
          }
          const cardContent = [];
          if (Array.isArray(campo.valor)) {
            for (const item of campo.valor) {
              cardContent.push({ value: `- ${item}` });
            }
          } else {
            cardContent.push({ value: String(campo.valor) });
          }
          ctx = drawDynamicCard(ctx, cardContent, { bgColor: ctx.colors.cardBgTertiary });
        }
      }
      ctx.yPosition -= 8;
    }
  }

  ctx.yPosition -= 16;
  return ctx;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { processo_id } = body;

    console.log('[generate-analysis-pdf] Recebido request para processo_id:', processo_id);

    if (!processo_id) {
      return new Response(
        JSON.stringify({ error: 'processo_id e obrigatorio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('file_name, created_at')
      .eq('id', processo_id)
      .single();

    if (processoError || !processo) {
      return new Response(
        JSON.stringify({ error: 'Processo nao encontrado', processo_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: results, error: resultsError } = await supabase
      .from('analysis_results')
      .select('prompt_title, result_content, execution_order, status')
      .eq('processo_id', processo_id)
      .eq('status', 'completed')
      .order('execution_order');

    if (resultsError || !results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum resultado de analise encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-analysis-pdf] Gerando PDF formatado com ${results.length} secoes`);

    const pdfDoc = await PDFDocument.create();
    const colors = PDF_COLORS;
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const titleFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const pageWidth = 595;
    const margin = 40;

    const tempCtx: RenderContext = {
      pdfDoc,
      page: null as any,
      yPosition: 0,
      colors,
      fonts: { regular: regularFont, bold: boldFont, title: titleFont },
      margin,
      pageWidth,
      pageHeight: 0,
    };

    let coverHeight = 60;
    const logoBytes = await loadLogo();
    if (logoBytes) {
      coverHeight += 60 + 35;
    } else {
      coverHeight += 35;
    }

    coverHeight += 22 + 35;
    const subtitle = normalizeText(processo.file_name || 'Processo');
    const subtitleMeasure = measureText(subtitle, regularFont, 12, pageWidth - 2 * margin);
    coverHeight += subtitleMeasure.totalHeight + 55;

    const sortedResults = results
      .filter((r: any) => r.status === 'completed' && r.result_content)
      .sort((a: any, b: any) => a.execution_order - b.execution_order);

    const contentHeight = measureContentHeight(tempCtx, sortedResults);
    const footerHeight = 50;
    const totalPageHeight = coverHeight + contentHeight + footerHeight;

    const page = pdfDoc.addPage([pageWidth, totalPageHeight]);

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: totalPageHeight,
      color: rgb(colors.background.r, colors.background.g, colors.background.b),
    });

    let currentY = totalPageHeight - 60;

    if (logoBytes) {
      try {
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoHeight = 60;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        const logoX = (pageWidth - logoWidth) / 2;

        page.drawImage(logoImage, {
          x: logoX,
          y: currentY - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        currentY -= logoHeight + 35;
      } catch {
        currentY -= 35;
      }
    } else {
      currentY -= 35;
    }

    const title = normalizeText('Analise Juridica - Wis Legal');
    const titleWidth = titleFont.widthOfTextAtSize(title, 22);
    const titleX = (pageWidth - titleWidth) / 2;

    page.drawText(title, {
      x: titleX,
      y: currentY,
      size: 22,
      font: titleFont,
      color: rgb(colors.textPrimary.r, colors.textPrimary.g, colors.textPrimary.b),
    });
    currentY -= 35;

    const subtitleX = (pageWidth - regularFont.widthOfTextAtSize(subtitleMeasure.lines[0] || '', 12)) / 2;
    page.drawText(subtitleMeasure.lines[0] || '', {
      x: subtitleX,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
    });
    currentY -= 55;

    let ctx: RenderContext = {
      pdfDoc,
      page,
      yPosition: currentY,
      colors,
      fonts: { regular: regularFont, bold: boldFont, title: titleFont },
      margin,
      pageWidth,
      pageHeight: totalPageHeight,
    };

    for (const result of sortedResults) {
      ctx = renderAnalysisContent(ctx, result);
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    page.drawText(normalizeText(`Gerado em: ${dateStr}`), {
      x: margin,
      y: 25,
      size: 7,
      font: regularFont,
      color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
    });
    page.drawText(normalizeText('(c) 2025 Wis Legal. Todos os direitos reservados.'), {
      x: pageWidth - 240,
      y: 25,
      size: 7,
      font: regularFont,
      color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
    });

    const pdfBytes = await pdfDoc.save();

    console.log(`[generate-analysis-pdf] PDF formatado gerado: ${pdfBytes.length} bytes`);

    const fileName = `${processo_id}/analysis.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('processos')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('[generate-analysis-pdf] Erro ao fazer upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar PDF no storage', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: urlData } = supabase.storage
      .from('processos')
      .getPublicUrl(fileName);

    const pdfUrl = urlData.publicUrl;

    await supabase
      .from('processos')
      .update({ analysis_pdf_url: pdfUrl })
      .eq('id', processo_id);

    console.log(`[generate-analysis-pdf] PDF salvo com sucesso: ${pdfUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: pdfUrl,
        file_path: fileName,
        size_bytes: pdfBytes.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-analysis-pdf] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
