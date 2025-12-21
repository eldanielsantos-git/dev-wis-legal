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
    if (ctx.yPosition < requiredSpace) {
      const newPage = ctx.pdfDoc.addPage(PageSizes.A4);
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: ctx.pageWidth,
        height: ctx.pageHeight,
        color: rgb(ctx.colors.background.r, ctx.colors.background.g, ctx.colors.background.b),
      });
      return { ...ctx, page: newPage, yPosition: ctx.pageHeight - 50 };
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
  ): { ctx: RenderContext; endY: number } {
    const font = options.font || ctx.fonts.regular;
    const color = options.color || ctx.colors.textPrimary;
    const maxWidth = options.maxWidth || ctx.pageWidth - 2 * ctx.margin;

    if (!options.maxWidth) {
      ctx.page.drawText(this.normalizeText(text), {
        x,
        y,
        size: options.size,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      return { ctx, endY: y - options.size * 1.5 };
    }

    const words = this.normalizeText(text).split(' ');
    let currentLine = '';
    let currentY = y;
    const lineHeight = options.size * 1.5;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, options.size);

      if (width > maxWidth && currentLine) {
        let newCtx = this.checkNewPage(ctx, 100);
        if (newCtx.page !== ctx.page) {
          ctx = newCtx;
          currentY = ctx.yPosition;
        }

        ctx.page.drawText(currentLine, {
          x,
          y: currentY,
          size: options.size,
          font,
          color: rgb(color.r, color.g, color.b),
        });
        currentLine = word;
        currentY -= lineHeight;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      let newCtx = this.checkNewPage(ctx, 100);
      if (newCtx.page !== ctx.page) {
        ctx = newCtx;
        currentY = ctx.yPosition;
      }

      ctx.page.drawText(currentLine, {
        x,
        y: currentY,
        size: options.size,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      currentY -= lineHeight;
    }

    return { ctx, endY: currentY };
  }

  private static drawCard(
    ctx: RenderContext,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      bgColor?: { r: number; g: number; b: number };
      borderColor?: { r: number; g: number; b: number };
      borderWidth?: number;
      borderLeft?: boolean;
    } = {}
  ): void {
    const bgColor = options.bgColor || ctx.colors.cardBg;
    const borderColor = options.borderColor || ctx.colors.border;
    const borderWidth = options.borderWidth || 1;

    ctx.page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b),
      borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
      borderWidth,
    });

    if (options.borderLeft) {
      ctx.page.drawRectangle({
        x,
        y,
        width: 4,
        height,
        color: rgb(borderColor.r, borderColor.g, borderColor.b),
      });
    }
  }

  private static drawBadge(
    ctx: RenderContext,
    text: string,
    x: number,
    y: number,
    color: { r: number; g: number; b: number }
  ): { width: number; height: number } {
    const padding = 4;
    const textWidth = ctx.fonts.regular.widthOfTextAtSize(this.normalizeText(text), 8);
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = 14;

    ctx.page.drawRectangle({
      x,
      y,
      width: badgeWidth,
      height: badgeHeight,
      color: rgb(color.r * 0.2, color.g * 0.2, color.b * 0.2),
      borderColor: rgb(color.r, color.g, color.b),
      borderWidth: 1,
    });

    ctx.page.drawText(this.normalizeText(text), {
      x: x + padding,
      y: y + 3,
      size: 8,
      font: ctx.fonts.regular,
      color: rgb(color.r, color.g, color.b),
    });

    return { width: badgeWidth, height: badgeHeight };
  }

  private static drawSectionHeader(
    ctx: RenderContext,
    title: string,
    y: number
  ): { ctx: RenderContext; endY: number } {
    ctx = this.checkNewPage(ctx, 100);

    const result = this.drawText(ctx, title, ctx.margin, y, {
      size: 16,
      font: ctx.fonts.bold,
      color: ctx.colors.textPrimary,
    });

    ctx.page.drawLine({
      start: { x: ctx.margin, y: result.endY + 8 },
      end: { x: ctx.pageWidth - ctx.margin, y: result.endY + 8 },
      thickness: 1,
      color: rgb(ctx.colors.border.r, ctx.colors.border.g, ctx.colors.border.b),
    });

    return { ctx: result.ctx, endY: result.endY - 5 };
  }

  private static renderFieldGrid(
    ctx: RenderContext,
    fields: Array<{ label: string; value: string }>,
    y: number,
    columns: number = 3
  ): { ctx: RenderContext; endY: number } {
    const cardWidth = ctx.pageWidth - 2 * ctx.margin;
    const gap = 8;
    const fieldWidth = (cardWidth - gap * (columns - 1)) / columns;
    const fieldHeight = 40;

    let currentY = y;
    let currentX = ctx.margin;
    let col = 0;

    for (const field of fields) {
      ctx = this.checkNewPage(ctx, fieldHeight + 20);
      if (ctx.yPosition !== currentY && col > 0) {
        currentY = ctx.yPosition;
        currentX = ctx.margin;
        col = 0;
      }

      this.drawCard(ctx, currentX, currentY - fieldHeight, fieldWidth, fieldHeight, {
        bgColor: ctx.colors.cardBgTertiary,
      });

      this.drawText(ctx, field.label, currentX + 6, currentY - 12, {
        size: 8,
        font: ctx.fonts.bold,
        color: ctx.colors.textSecondary,
        maxWidth: fieldWidth - 12,
      });

      this.drawText(ctx, field.value, currentX + 6, currentY - 26, {
        size: 10,
        color: ctx.colors.textPrimary,
        maxWidth: fieldWidth - 12,
      });

      col++;
      if (col >= columns) {
        col = 0;
        currentX = ctx.margin;
        currentY -= fieldHeight + gap;
      } else {
        currentX += fieldWidth + gap;
      }
    }

    if (col > 0) {
      currentY -= fieldHeight + gap;
    }

    return { ctx, endY: currentY - 10 };
  }

  private static async renderAnalysisContent(
    ctx: RenderContext,
    result: AnalysisResult
  ): Promise<{ ctx: RenderContext; endY: number }> {
    const data = this.parseContent(result.result_content);
    if (!data) {
      return { ctx, endY: ctx.yPosition - 20 };
    }

    let headerResult = this.drawSectionHeader(ctx, result.prompt_title, ctx.yPosition);
    ctx = headerResult.ctx;
    let currentY = headerResult.endY - 15;

    const promptType = result.prompt_type;

    // Detectar tipo de análise e renderizar apropriadamente
    if (data.visaoGeralProcesso) {
      const analysis = data.visaoGeralProcesso;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        // Título da seção
        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        // Campos
        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label,
            value: String(c.valor || ''),
          }));
          const gridResult = this.renderFieldGrid(ctx, fields, currentY, 3);
          ctx = gridResult.ctx;
          currentY = gridResult.endY - 10;
        }

        // Lista de partes
        if (secao.lista && secao.lista.length > 0) {
          for (const parte of secao.lista) {
            ctx = this.checkNewPage(ctx, 60);
            currentY = ctx.yPosition;

            const cardY = currentY - 55;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, 50, {
              bgColor: ctx.colors.cardBgTertiary,
            });

            this.drawText(ctx, String(parte.nome || ''), ctx.margin + 10, currentY - 10, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(
              ctx,
              `CPF/CNPJ: ${parte.cpfCnpj || ''} | Polo: ${parte.Polo || ''}`,
              ctx.margin + 10,
              currentY - 28,
              {
                size: 8,
                color: ctx.colors.textSecondary,
              }
            );

            currentY -= 65;
          }
        }

        currentY -= 10;
      }
    } else if (data.resumoEstrategico) {
      const analysis = data.resumoEstrategico;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label || '',
            value: String(c.valor || ''),
          }));
          const gridResult = this.renderFieldGrid(ctx, fields, currentY, 2);
          ctx = gridResult.ctx;
          currentY = gridResult.endY - 10;
        }

        currentY -= 10;
      }
    } else if (data.comunicacoesPrazos) {
      const analysis = data.comunicacoesPrazos;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.listaAtos && secao.listaAtos.length > 0) {
          for (let i = 0; i < secao.listaAtos.length; i++) {
            const ato = secao.listaAtos[i];
            ctx = this.checkNewPage(ctx, 120);
            currentY = ctx.yPosition;

            const cardHeight = 100;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.blue,
            });

            this.drawText(ctx, `Ato ${i + 1} - ${ato.tipoAto || ''}`, ctx.margin + 10, currentY - 15, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(ctx, `Modalidade: ${ato.modalidade || ''}`, ctx.margin + 10, currentY - 32, {
              size: 8,
              color: ctx.colors.textSecondary,
            });

            if (ato.destinatario) {
              const dest = Array.isArray(ato.destinatario) ? ato.destinatario[0] : ato.destinatario;
              this.drawText(
                ctx,
                `Destinatario: ${dest.nome || ''} - ${dest.status || ''}`,
                ctx.margin + 10,
                currentY - 48,
                {
                  size: 8,
                  color: ctx.colors.textSecondary,
                }
              );
            }

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.recursosAdmissibilidade) {
      const analysis = data.recursosAdmissibilidade;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.listaRecursosIdentificados && secao.listaRecursosIdentificados.length > 0) {
          for (let i = 0; i < secao.listaRecursosIdentificados.length; i++) {
            const recurso = secao.listaRecursosIdentificados[i];
            ctx = this.checkNewPage(ctx, 100);
            currentY = ctx.yPosition;

            const cardHeight = 90;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.purple,
            });

            this.drawText(ctx, `Recurso ${i + 1} - ${recurso.tipoRecurso || ''}`, ctx.margin + 10, currentY - 15, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(
              ctx,
              `Tempestividade: ${recurso.tempestividade || ''} | Situacao: ${recurso.situacaoAtual || ''}`,
              ctx.margin + 10,
              currentY - 32,
              {
                size: 8,
                color: ctx.colors.textSecondary,
              }
            );

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.estrategiasJuridicas) {
      const analysis = data.estrategiasJuridicas;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.listaEstrategias && secao.listaEstrategias.length > 0) {
          for (const estrategia of secao.listaEstrategias) {
            ctx = this.checkNewPage(ctx, 140);
            currentY = ctx.yPosition;

            const cardHeight = 130;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.green,
            });

            this.drawText(ctx, estrategia.polo || '', ctx.margin + 10, currentY - 15, {
              size: 11,
              font: ctx.fonts.bold,
            });

            if (estrategia.estrategiaPrincipal) {
              const ep = estrategia.estrategiaPrincipal;
              const descResult = this.drawText(
                ctx,
                `Estrategia: ${ep.descricao || ''}`,
                ctx.margin + 10,
                currentY - 35,
                {
                  size: 8,
                  color: ctx.colors.textSecondary,
                  maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
                }
              );
              ctx = descResult.ctx;
            }

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.riscosAlertasProcessuais) {
      const analysis = data.riscosAlertasProcessuais;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.listaAlertas && secao.listaAlertas.length > 0) {
          for (let i = 0; i < secao.listaAlertas.length; i++) {
            const alerta = secao.listaAlertas[i];
            ctx = this.checkNewPage(ctx, 120);
            currentY = ctx.yPosition;

            const cardHeight = 110;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.red,
            });

            this.drawText(ctx, `Alerta ${i + 1} - ${alerta.categoria || ''}`, ctx.margin + 10, currentY - 15, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(
              ctx,
              `Gravidade: ${alerta.gravidade || ''} | Polo: ${alerta.poloAfetado || ''}`,
              ctx.margin + 10,
              currentY - 32,
              {
                size: 8,
                color: ctx.colors.textSecondary,
              }
            );

            const descResult = this.drawText(ctx, alerta.descricaoRisco || '', ctx.margin + 10, currentY - 50, {
              size: 8,
              color: ctx.colors.textSecondary,
              maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
            });
            ctx = descResult.ctx;

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.balancoFinanceiro) {
      const analysis = data.balancoFinanceiro;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.green,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.campos && secao.campos.length > 0) {
          const fields = secao.campos.map((c: any) => ({
            label: c.label || '',
            value: String(c.valor || ''),
          }));
          const gridResult = this.renderFieldGrid(ctx, fields, currentY, 2);
          ctx = gridResult.ctx;
          currentY = gridResult.endY - 10;
        }

        if (secao.listaHonorarios && secao.listaHonorarios.length > 0) {
          for (let i = 0; i < secao.listaHonorarios.length; i++) {
            const hon = secao.listaHonorarios[i];
            ctx = this.checkNewPage(ctx, 80);
            currentY = ctx.yPosition;

            const cardHeight = 70;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.purple,
            });

            this.drawText(ctx, `Honorario ${i + 1} - ${hon.tipo || ''}`, ctx.margin + 10, currentY - 15, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(
              ctx,
              `Valor: ${hon.valorEstimado || ''} | Polo: ${hon.poloBeneficiado || ''}`,
              ctx.margin + 10,
              currentY - 32,
              {
                size: 8,
                color: ctx.colors.textSecondary,
              }
            );

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.mapaPreclusoesProcessuais) {
      const analysis = data.mapaPreclusoesProcessuais;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.amber,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.listaPreclusoesRecentes && secao.listaPreclusoesRecentes.length > 0) {
          for (let i = 0; i < secao.listaPreclusoesRecentes.length; i++) {
            const prec = secao.listaPreclusoesRecentes[i];
            ctx = this.checkNewPage(ctx, 100);
            currentY = ctx.yPosition;

            const cardHeight = 90;
            const cardY = currentY - cardHeight;
            this.drawCard(ctx, ctx.margin, cardY, ctx.pageWidth - 2 * ctx.margin, cardHeight, {
              borderLeft: true,
              borderColor: ctx.colors.amber,
            });

            this.drawText(ctx, `Preclusao ${i + 1} - ${prec.tipo || ''}`, ctx.margin + 10, currentY - 15, {
              size: 10,
              font: ctx.fonts.bold,
            });

            this.drawText(ctx, `Polo: ${prec.poloAfetado || ''}`, ctx.margin + 10, currentY - 32, {
              size: 8,
              color: ctx.colors.textSecondary,
            });

            const atoResult = this.drawText(ctx, prec.atoOuFaseAtingida || '', ctx.margin + 10, currentY - 48, {
              size: 8,
              color: ctx.colors.textSecondary,
              maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
            });
            ctx = atoResult.ctx;

            currentY -= cardHeight + 10;
          }
        }

        currentY -= 10;
      }
    } else if (data.conclusoesPerspectivas) {
      const analysis = data.conclusoesPerspectivas;
      for (const secao of analysis.secoes || []) {
        ctx = this.checkNewPage(ctx, 100);
        currentY = ctx.yPosition;

        const titleResult = this.drawText(ctx, secao.titulo, ctx.margin + 5, currentY, {
          size: 12,
          font: ctx.fonts.bold,
          color: ctx.colors.blue,
        });
        ctx = titleResult.ctx;
        currentY = titleResult.endY - 10;

        if (secao.campos && secao.campos.length > 0) {
          for (const campo of secao.campos) {
            ctx = this.checkNewPage(ctx, 80);
            currentY = ctx.yPosition;

            if (campo.label) {
              const labelResult = this.drawText(ctx, campo.label, ctx.margin + 5, currentY, {
                size: 9,
                font: ctx.fonts.bold,
                color: ctx.colors.textSecondary,
              });
              ctx = labelResult.ctx;
              currentY = labelResult.endY - 5;
            }

            if (Array.isArray(campo.valor)) {
              for (const item of campo.valor) {
                const itemResult = this.drawText(ctx, `• ${item}`, ctx.margin + 10, currentY, {
                  size: 8,
                  color: ctx.colors.textPrimary,
                  maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
                });
                ctx = itemResult.ctx;
                currentY = itemResult.endY - 3;
              }
            } else {
              const valueResult = this.drawText(ctx, String(campo.valor), ctx.margin + 10, currentY, {
                size: 8,
                color: ctx.colors.textPrimary,
                maxWidth: ctx.pageWidth - 2 * ctx.margin - 20,
              });
              ctx = valueResult.ctx;
              currentY = valueResult.endY - 5;
            }

            currentY -= 10;
          }
        }

        currentY -= 10;
      }
    } else {
      // Fallback genérico
      const contentText = JSON.stringify(data, null, 2)
        .substring(0, 500)
        .replace(/[{}"[\],]/g, ' ');
      const textResult = this.drawText(ctx, contentText, ctx.margin, currentY, {
        size: 8,
        color: ctx.colors.textSecondary,
        maxWidth: ctx.pageWidth - 2 * ctx.margin,
      });
      ctx = textResult.ctx;
      currentY = textResult.endY - 20;
    }

    return { ctx, endY: currentY - 20 };
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
    currentY -= 40;

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
      const renderResult = await this.renderAnalysisContent(ctx, result);
      ctx = renderResult.ctx;
      ctx.yPosition = renderResult.endY;
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
