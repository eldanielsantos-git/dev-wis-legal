import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import type { AnalysisResult } from './AnalysisResultsService';

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
  orange: { r: number; g: number; b: number };
  slate: { r: number; g: number; b: number };
}

const PDF_COLORS: Record<'dark' | 'light', PDFColors> = {
  dark: {
    background: { r: 15 / 255, g: 14 / 255, b: 13 / 255 },
    cardBg: { r: 31 / 255, g: 34 / 255, b: 41 / 255 },
    cardBgTertiary: { r: 42 / 255, g: 46 / 255, b: 54 / 255 },
    textPrimary: { r: 250 / 255, g: 250 / 255, b: 250 / 255 },
    textSecondary: { r: 156 / 255, g: 163 / 255, b: 175 / 255 },
    border: { r: 55 / 255, g: 65 / 255, b: 81 / 255 },
    blue: { r: 96 / 255, g: 165 / 255, b: 250 / 255 },
    green: { r: 74 / 255, g: 222 / 255, b: 128 / 255 },
    red: { r: 248 / 255, g: 113 / 255, b: 113 / 255 },
    amber: { r: 251 / 255, g: 191 / 255, b: 36 / 255 },
    purple: { r: 196 / 255, g: 181 / 255, b: 253 / 255 },
    orange: { r: 251 / 255, g: 146 / 255, b: 60 / 255 },
    slate: { r: 148 / 255, g: 163 / 255, b: 184 / 255 },
  },
  light: {
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
    orange: { r: 249 / 255, g: 115 / 255, b: 22 / 255 },
    slate: { r: 100 / 255, g: 116 / 255, b: 139 / 255 },
  },
};

const LOGO_URLS = {
  dark: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/wislegal-logo-PDF-dark.png',
  light: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/wislegal-logo-PDF-white.png',
};

interface RenderContext {
  pdfDoc: PDFDocument;
  page: PDFPage;
  yPosition: number;
  theme: 'dark' | 'light';
  colors: PDFColors;
  fonts: { regular: PDFFont; bold: PDFFont };
  margin: number;
  pageWidth: number;
  pageHeight: number;
}

export class PDFExportService {
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }

  private static async loadLogo(theme: 'dark' | 'light'): Promise<Uint8Array | null> {
    try {
      const response = await fetch(LOGO_URLS[theme], { mode: 'cors' });
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch {
      return null;
    }
  }

  private static parseContent(content: string): any {
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

  private static checkNewPage(ctx: RenderContext, requiredSpace: number): RenderContext {
    if (ctx.yPosition < requiredSpace + 60) {
      const newPage = ctx.pdfDoc.addPage(PageSizes.A4);
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: ctx.pageWidth,
        height: ctx.pageHeight,
        color: rgb(ctx.colors.background.r, ctx.colors.background.g, ctx.colors.background.b),
      });
      return { ...ctx, page: newPage, yPosition: ctx.pageHeight - 60 };
    }
    return ctx;
  }

  private static drawText(
    ctx: RenderContext,
    text: string,
    x: number,
    y: number,
    options: {
      size: number;
      font?: PDFFont;
      color?: { r: number; g: number; b: number };
      maxWidth?: number;
    }
  ): { ctx: RenderContext; endY: number; lineCount: number } {
    const font = options.font || ctx.fonts.regular;
    const color = options.color || ctx.colors.textPrimary;
    const maxWidth = options.maxWidth || ctx.pageWidth - 2 * ctx.margin;

    if (!text || text.trim() === '') {
      return { ctx, endY: y, lineCount: 0 };
    }

    const normalized = this.normalizeText(text);
    const words = normalized.split(' ');
    let currentLine = '';
    let currentY = y;
    const lineHeight = options.size * 1.5;
    let lineCount = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, options.size);

      if (width > maxWidth && currentLine) {
        ctx = this.checkNewPage(ctx, 100);

        ctx.page.drawText(currentLine, {
          x,
          y: ctx.yPosition,
          size: options.size,
          font,
          color: rgb(color.r, color.g, color.b),
        });

        currentLine = word;
        ctx.yPosition -= lineHeight;
        lineCount++;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      ctx = this.checkNewPage(ctx, 100);

      ctx.page.drawText(currentLine, {
        x,
        y: ctx.yPosition,
        size: options.size,
        font,
        color: rgb(color.r, color.g, color.b),
      });

      ctx.yPosition -= lineHeight;
      lineCount++;
    }

    return { ctx, endY: ctx.yPosition, lineCount };
  }

  private static drawCard(
    ctx: RenderContext,
    height: number,
    options: {
      bgColor?: { r: number; g: number; b: number };
      borderColor?: { r: number; g: number; b: number };
      borderWidth?: number;
      borderLeft?: boolean;
      padding?: number;
    } = {}
  ): RenderContext {
    const bgColor = options.bgColor || ctx.colors.cardBg;
    const borderColor = options.borderColor || ctx.colors.border;
    const borderWidth = options.borderWidth || 1;
    const padding = options.padding || 10;

    ctx = this.checkNewPage(ctx, height + 20);

    const cardWidth = ctx.pageWidth - 2 * ctx.margin;
    const cardY = ctx.yPosition - height;

    ctx.page.drawRectangle({
      x: ctx.margin,
      y: cardY,
      width: cardWidth,
      height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
      borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
      borderWidth,
    });

    if (options.borderLeft) {
      ctx.page.drawRectangle({
        x: ctx.margin,
        y: cardY,
        width: 4,
        height,
        color: rgb(borderColor.r, borderColor.g, borderColor.b),
      });
    }

    ctx.yPosition -= padding;
    return ctx;
  }

  private static drawSectionHeader(
    ctx: RenderContext,
    title: string
  ): RenderContext {
    ctx = this.checkNewPage(ctx, 50);

    ctx.page.drawText(this.normalizeText(title), {
      x: ctx.margin,
      y: ctx.yPosition,
      size: 16,
      font: ctx.fonts.bold,
      color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
    });

    ctx.yPosition -= 20;

    ctx.page.drawLine({
      start: { x: ctx.margin, y: ctx.yPosition },
      end: { x: ctx.pageWidth - ctx.margin, y: ctx.yPosition },
      thickness: 1,
      color: rgb(ctx.colors.border.r, ctx.colors.border.g, ctx.colors.border.b),
    });

    ctx.yPosition -= 20;
    return ctx;
  }

  private static drawSubsectionTitle(
    ctx: RenderContext,
    title: string,
    color?: { r: number; g: number; b: number }
  ): RenderContext {
    ctx = this.checkNewPage(ctx, 40);

    ctx.page.drawText(this.normalizeText(title), {
      x: ctx.margin + 5,
      y: ctx.yPosition,
      size: 12,
      font: ctx.fonts.bold,
      color: rgb(
        (color || ctx.colors.blue).r,
        (color || ctx.colors.blue).g,
        (color || ctx.colors.blue).b
      ),
    });

    ctx.yPosition -= 25;
    return ctx;
  }

  private static renderFieldGrid(
    ctx: RenderContext,
    fields: Array<{ label: string; value: string }>,
    columns: number = 3
  ): RenderContext {
    if (!fields || fields.length === 0) return ctx;

    const gap = 8;
    const cardWidth = ctx.pageWidth - 2 * ctx.margin;
    const fieldWidth = (cardWidth - gap * (columns - 1)) / columns;
    const fieldHeight = 50;

    let col = 0;

    for (const field of fields) {
      if (col === 0) {
        ctx = this.checkNewPage(ctx, fieldHeight + 20);
      }

      const x = ctx.margin + col * (fieldWidth + gap);
      const y = ctx.yPosition;

      ctx.page.drawRectangle({
        x,
        y: y - fieldHeight,
        width: fieldWidth,
        height: fieldHeight,
        color: rgb(ctx.colors.cardBgTertiary.r, ctx.colors.cardBgTertiary.g, ctx.colors.cardBgTertiary.b),
        borderColor: rgb(ctx.colors.border.r, ctx.colors.border.g, ctx.colors.border.b),
        borderWidth: 1,
      });

      ctx.page.drawText(this.normalizeText(field.label).substring(0, 50), {
        x: x + 6,
        y: y - 15,
        size: 8,
        font: ctx.fonts.bold,
        color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
      });

      const valueText = this.normalizeText(String(field.value)).substring(0, 80);
      ctx.page.drawText(valueText, {
        x: x + 6,
        y: y - 32,
        size: 9,
        font: ctx.fonts.regular,
        color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
      });

      col++;
      if (col >= columns) {
        col = 0;
        ctx.yPosition -= fieldHeight + gap;
      }
    }

    if (col > 0) {
      ctx.yPosition -= fieldHeight + gap;
    }

    ctx.yPosition -= 10;
    return ctx;
  }

  private static async renderAnalysisContent(
    ctx: RenderContext,
    result: AnalysisResult
  ): Promise<RenderContext> {
    const data = this.parseContent(result.result_content);
    if (!data) {
      return ctx;
    }

    ctx = this.drawSectionHeader(ctx, result.prompt_title);

    if (data.visaoGeralProcesso) {
      const analysis = data.visaoGeralProcesso;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label || '',
            value: String(c.valor || ''),
          }));
          ctx = this.renderFieldGrid(ctx, fields, 3);
        }

        if (secao.lista && secao.lista.length > 0) {
          for (const parte of secao.lista) {
            ctx = this.drawCard(ctx, 60, { bgColor: ctx.colors.cardBgTertiary });

            ctx.page.drawText(this.normalizeText(String(parte.nome || '')).substring(0, 80), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 10,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 18;

            const infoText = `CPF/CNPJ: ${parte.cpfCnpj || ''} | Polo: ${parte.Polo || ''}`;
            ctx.page.drawText(this.normalizeText(infoText).substring(0, 80), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 25;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.resumoEstrategico) {
      const analysis = data.resumoEstrategico;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label || '',
            value: String(c.valor || ''),
          }));
          ctx = this.renderFieldGrid(ctx, fields, 2);
        }

        ctx.yPosition -= 15;
      }
    } else if (data.comunicacoesPrazos) {
      const analysis = data.comunicacoesPrazos;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.listaAtos && secao.listaAtos.length > 0) {
          for (let i = 0; i < secao.listaAtos.length; i++) {
            const ato = secao.listaAtos[i];
            ctx = this.drawCard(ctx, 90, { borderLeft: true, borderColor: ctx.colors.blue });

            ctx.page.drawText(this.normalizeText(`Ato ${i + 1} - ${ato.tipoAto || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 10,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 18;

            ctx.page.drawText(this.normalizeText(`Modalidade: ${ato.modalidade || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 15;

            if (ato.destinatario) {
              const dest = Array.isArray(ato.destinatario) ? ato.destinatario[0] : ato.destinatario;
              const destText = `Destinatario: ${dest?.nome || ''} - ${dest?.status || ''}`;
              ctx.page.drawText(this.normalizeText(destText).substring(0, 70), {
                x: ctx.margin + 15,
                y: ctx.yPosition,
                size: 8,
                color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
              });

              ctx.yPosition -= 15;
            }

            ctx.yPosition -= 20;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.recursosAdmissibilidade) {
      const analysis = data.recursosAdmissibilidade;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.listaRecursosIdentificados && secao.listaRecursosIdentificados.length > 0) {
          for (let i = 0; i < secao.listaRecursosIdentificados.length; i++) {
            const recurso = secao.listaRecursosIdentificados[i];
            ctx = this.drawCard(ctx, 70, { borderLeft: true, borderColor: ctx.colors.purple });

            ctx.page.drawText(
              this.normalizeText(`Recurso ${i + 1} - ${recurso.tipoRecurso || ''}`).substring(0, 70),
              {
                x: ctx.margin + 15,
                y: ctx.yPosition,
                size: 10,
                font: ctx.fonts.bold,
                color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
              }
            );

            ctx.yPosition -= 18;

            const infoText = `Tempestividade: ${recurso.tempestividade || ''} | Situacao: ${recurso.situacaoAtual || ''}`;
            ctx.page.drawText(this.normalizeText(infoText).substring(0, 80), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 20;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.estrategiasJuridicas) {
      const analysis = data.estrategiasJuridicas;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.listaEstrategias && secao.listaEstrategias.length > 0) {
          for (const estrategia of secao.listaEstrategias) {
            ctx = this.drawCard(ctx, 100, { borderLeft: true, borderColor: ctx.colors.green });

            ctx.page.drawText(this.normalizeText(estrategia.polo || '').substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 11,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 20;

            if (estrategia.estrategiaPrincipal) {
              const ep = estrategia.estrategiaPrincipal;
              const descText = `Estrategia: ${ep.descricao || ''}`;
              const result = this.drawText(ctx, descText, ctx.margin + 15, ctx.yPosition, {
                size: 8,
                color: ctx.colors.textSecondary,
                maxWidth: ctx.pageWidth - 2 * ctx.margin - 30,
              });
              ctx = result.ctx;
            }

            ctx.yPosition -= 20;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.riscosAlertasProcessuais) {
      const analysis = data.riscosAlertasProcessuais;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.listaAlertas && secao.listaAlertas.length > 0) {
          for (let i = 0; i < secao.listaAlertas.length; i++) {
            const alerta = secao.listaAlertas[i];
            ctx = this.drawCard(ctx, 100, { borderLeft: true, borderColor: ctx.colors.red });

            ctx.page.drawText(this.normalizeText(`Alerta ${i + 1} - ${alerta.categoria || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 10,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 18;

            const infoText = `Gravidade: ${alerta.gravidade || ''} | Polo: ${alerta.poloAfetado || ''}`;
            ctx.page.drawText(this.normalizeText(infoText).substring(0, 80), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 18;

            const result = this.drawText(ctx, alerta.descricaoRisco || '', ctx.margin + 15, ctx.yPosition, {
              size: 8,
              color: ctx.colors.textSecondary,
              maxWidth: ctx.pageWidth - 2 * ctx.margin - 30,
            });
            ctx = result.ctx;

            ctx.yPosition -= 15;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.balancoFinanceiro) {
      const analysis = data.balancoFinanceiro;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo, ctx.colors.green);

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label || '',
            value: String(c.valor || ''),
          }));
          ctx = this.renderFieldGrid(ctx, fields, 2);
        }

        if (secao.listaHonorarios && secao.listaHonorarios.length > 0) {
          for (let i = 0; i < secao.listaHonorarios.length; i++) {
            const hon = secao.listaHonorarios[i];
            ctx = this.drawCard(ctx, 70, { borderLeft: true, borderColor: ctx.colors.purple });

            ctx.page.drawText(this.normalizeText(`Honorario ${i + 1} - ${hon.tipo || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 10,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 18;

            const infoText = `Valor: ${hon.valorEstimado || ''} | Polo: ${hon.poloBeneficiado || ''}`;
            ctx.page.drawText(this.normalizeText(infoText).substring(0, 80), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 20;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.mapaPreclusoesProcessuais) {
      const analysis = data.mapaPreclusoesProcessuais;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo, ctx.colors.amber);

        if (secao.listaPreclusoesRecentes && secao.listaPreclusoesRecentes.length > 0) {
          for (let i = 0; i < secao.listaPreclusoesRecentes.length; i++) {
            const prec = secao.listaPreclusoesRecentes[i];
            ctx = this.drawCard(ctx, 90, { borderLeft: true, borderColor: ctx.colors.amber });

            ctx.page.drawText(this.normalizeText(`Preclusao ${i + 1} - ${prec.tipo || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 10,
              font: ctx.fonts.bold,
              color: rgb(ctx.colors.textPrimary.r, ctx.colors.textPrimary.g, ctx.colors.textPrimary.b),
            });

            ctx.yPosition -= 18;

            ctx.page.drawText(this.normalizeText(`Polo: ${prec.poloAfetado || ''}`).substring(0, 70), {
              x: ctx.margin + 15,
              y: ctx.yPosition,
              size: 8,
              color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
            });

            ctx.yPosition -= 18;

            const result = this.drawText(ctx, prec.atoOuFaseAtingida || '', ctx.margin + 15, ctx.yPosition, {
              size: 8,
              color: ctx.colors.textSecondary,
              maxWidth: ctx.pageWidth - 2 * ctx.margin - 30,
            });
            ctx = result.ctx;

            ctx.yPosition -= 15;
          }
        }

        ctx.yPosition -= 15;
      }
    } else if (data.conclusoesPerspectivas) {
      const analysis = data.conclusoesPerspectivas;
      for (const secao of analysis.secoes || []) {
        ctx = this.drawSubsectionTitle(ctx, secao.titulo);

        if (secao.campos && secao.campos.length > 0) {
          for (const campo of secao.campos) {
            ctx = this.checkNewPage(ctx, 60);

            if (campo.label) {
              ctx.page.drawText(this.normalizeText(campo.label).substring(0, 80), {
                x: ctx.margin + 5,
                y: ctx.yPosition,
                size: 9,
                font: ctx.fonts.bold,
                color: rgb(ctx.colors.textSecondary.r, ctx.colors.textSecondary.g, ctx.colors.textSecondary.b),
              });

              ctx.yPosition -= 18;
            }

            if (Array.isArray(campo.valor)) {
              for (const item of campo.valor) {
                const result = this.drawText(ctx, `• ${item}`, ctx.margin + 10, ctx.yPosition, {
                  size: 8,
                  color: ctx.colors.textPrimary,
                  maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
                });
                ctx = result.ctx;
                ctx.yPosition -= 5;
              }
            } else {
              const result = this.drawText(ctx, String(campo.valor), ctx.margin + 10, ctx.yPosition, {
                size: 8,
                color: ctx.colors.textPrimary,
                maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
              });
              ctx = result.ctx;
            }

            ctx.yPosition -= 15;
          }
        }

        ctx.yPosition -= 15;
      }
    }

    ctx.yPosition -= 20;
    return ctx;
  }

  static async generatePDF(
    processoName: string,
    analysisResults: AnalysisResult[],
    theme: 'dark' | 'light'
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();
    const colors = PDF_COLORS[theme];

    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage(PageSizes.A4);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const margin = 40;

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(colors.background.r, colors.background.g, colors.background.b),
    });

    let currentY = pageHeight - 60;

    // Logo
    try {
      const logoBytes = await this.loadLogo(theme);
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

          currentY -= logoHeight + 30;
        } catch {
          currentY -= 30;
        }
      } else {
        currentY -= 30;
      }
    } catch {
      currentY -= 30;
    }

    // Título
    const title = this.normalizeText('Analise Juridica - Wis Legal');
    const titleWidth = boldFont.widthOfTextAtSize(title, 22);
    const titleX = (pageWidth - titleWidth) / 2;

    page.drawText(title, {
      x: titleX,
      y: currentY,
      size: 22,
      font: boldFont,
      color: rgb(colors.textPrimary.r, colors.textPrimary.g, colors.textPrimary.b),
    });
    currentY -= 30;

    // Subtítulo
    const subtitle = this.normalizeText(processoName);
    const subtitleWidth = regularFont.widthOfTextAtSize(subtitle, 12);
    const subtitleX = (pageWidth - subtitleWidth) / 2;

    page.drawText(subtitle, {
      x: subtitleX,
      y: currentY,
      size: 12,
      font: regularFont,
      color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
    });
    currentY -= 50;

    // Renderizar análises
    let ctx: RenderContext = {
      pdfDoc,
      page,
      yPosition: currentY,
      theme,
      colors,
      fonts: { regular: regularFont, bold: boldFont },
      margin,
      pageWidth,
      pageHeight,
    };

    const sortedResults = analysisResults
      .filter((r) => r.status === 'completed' && r.result_content)
      .sort((a, b) => a.execution_order - b.execution_order);

    for (const result of sortedResults) {
      ctx = await this.renderAnalysisContent(ctx, result);
    }

    // Rodapé em todas as páginas
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const allPages = pdfDoc.getPages();
    allPages.forEach((p) => {
      p.drawText(this.normalizeText(`Gerado em: ${dateStr}`), {
        x: margin,
        y: 25,
        size: 7,
        font: regularFont,
        color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
      });
      p.drawText(this.normalizeText('(c) 2025 Wis Legal. Todos os direitos reservados.'), {
        x: pageWidth - 240,
        y: 25,
        size: 7,
        font: regularFont,
        color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
      });
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  static generateFileName(processoName: string): string {
    const now = new Date();
    const dateStr = now
      .toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      .replace(/\//g, '-');

    const cleanName = processoName
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);

    return `wis_legal_${cleanName}_analise_${dateStr}.pdf`;
  }
}
