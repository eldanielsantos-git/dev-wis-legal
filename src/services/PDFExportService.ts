import { PDFDocument, StandardFonts, rgb, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import type { AnalysisResult } from './AnalysisResultsService';

interface PDFColors {
  background: { r: number; g: number; b: number };
  cardBg: { r: number; g: number; b: number };
  textPrimary: { r: number; g: number; b: number };
  textSecondary: { r: number; g: number; b: number };
  accent: { r: number; g: number; b: number };
  border: { r: number; g: number; b: number };
}

interface AnalysisCardData {
  order: number;
  title: string;
  content: string;
}

const PDF_COLORS: Record<'dark' | 'light', PDFColors> = {
  dark: {
    background: { r: 15 / 255, g: 14 / 255, b: 13 / 255 }, // #0F0E0D
    cardBg: { r: 31 / 255, g: 34 / 255, b: 41 / 255 }, // #1F2229
    textPrimary: { r: 250 / 255, g: 250 / 255, b: 250 / 255 }, // #FAFAFA
    textSecondary: { r: 156 / 255, g: 163 / 255, b: 175 / 255 }, // #9CA3AF
    accent: { r: 28 / 255, g: 155 / 255, b: 241 / 255 }, // #1C9BF1
    border: { r: 55 / 255, g: 65 / 255, b: 81 / 255 }, // #374151
  },
  light: {
    background: { r: 250 / 255, g: 250 / 255, b: 250 / 255 }, // #FAFAFA
    cardBg: { r: 255 / 255, g: 255 / 255, b: 255 / 255 }, // #FFFFFF
    textPrimary: { r: 15 / 255, g: 14 / 255, b: 13 / 255 }, // #0F0E0D
    textSecondary: { r: 107 / 255, g: 114 / 255, b: 128 / 255 }, // #6B7280
    accent: { r: 28 / 255, g: 155 / 255, b: 241 / 255 }, // #1C9BF1
    border: { r: 229 / 255, g: 231 / 255, b: 235 / 255 }, // #E5E7EB
  },
};

const LOGO_URLS = {
  dark: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/wislegal-logo-PDF-dark.png',
  light: 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/wislegal-logo-PDF-white.png',
};

const ANALYSIS_COLORS: Record<number, { r: number; g: number; b: number }> = {
  1: { r: 59 / 255, g: 130 / 255, b: 246 / 255 },
  2: { r: 168 / 255, g: 85 / 255, b: 247 / 255 },
  3: { r: 234 / 255, g: 179 / 255, b: 8 / 255 },
  4: { r: 239 / 255, g: 68 / 255, b: 68 / 255 },
  5: { r: 34 / 255, g: 197 / 255, b: 94 / 255 },
  6: { r: 249 / 255, g: 115 / 255, b: 22 / 255 },
  7: { r: 6 / 255, g: 182 / 255, b: 212 / 255 },
  8: { r: 139 / 255, g: 92 / 255, b: 246 / 255 },
  9: { r: 16 / 255, g: 185 / 255, b: 129 / 255 },
};

const ANALYSIS_SYMBOLS: Record<number, string> = {
  1: '\u25A0',
  2: '\u25C6',
  3: '\u25B2',
  4: '\u25CF',
  5: '\u2605',
  6: '\u26A0',
  7: '\u25B6',
  8: '\u25C9',
  9: '\u2713',
};

export class PDFExportService {
  private static normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7F]/g, '');
  }

  private static async loadLogo(theme: 'dark' | 'light'): Promise<Uint8Array | null> {
    try {
      const response = await fetch(LOGO_URLS[theme], { mode: 'cors' });
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      return null;
    }
  }

  private static extractAnalysisData(analysisResults: AnalysisResult[]): AnalysisCardData[] {
    return analysisResults
      .filter(result => result.status === 'completed' && result.result_content)
      .sort((a, b) => a.execution_order - b.execution_order)
      .map(result => ({
        order: result.execution_order,
        title: result.prompt_title,
        content: result.result_content,
      }));
  }

  private static formatObjectToText(obj: any, level: number = 0): string {
    if (obj === null || obj === undefined) {
      return '';
    }

    if (typeof obj === 'string') {
      return obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '';

      const allStrings = obj.every(item => typeof item === 'string');

      if (allStrings) {
        return obj.map(item => `- ${item}`).join('\n');
      }

      return obj.map((item, index) => {
        if (typeof item === 'object') {
          return `\n${index + 1}. ${this.formatObjectToText(item, level + 1)}`;
        }
        return `- ${item}`;
      }).join('\n');
    }

    if (typeof obj === 'object') {
      const lines: string[] = [];

      for (const [key, value] of Object.entries(obj)) {
        const isEmpty =
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);

        if (isEmpty) continue;

        const formattedKey = key
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        const formattedValue = this.formatObjectToText(value, level + 1);

        if (formattedValue) {
          lines.push(`${formattedKey}: ${formattedValue}`);
        }
      }

      return lines.join('\n');
    }

    return String(obj);
  }

  private static cleanContent(content: string): string {
    try {
      if (!content || content.trim() === '') {
        return this.normalizeText('Conteudo nao disponivel');
      }

      let cleaned = content.trim();

      cleaned = cleaned.replace(/^```json\s*/i, '');
      cleaned = cleaned.replace(/^```\s*/i, '');
      cleaned = cleaned.replace(/\s*```\s*$/i, '');
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      if (typeof parsed === 'string') {
        return this.normalizeText(parsed);
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const formatted = this.formatObjectToText(parsed);
        return this.normalizeText(formatted);
      }

      return this.normalizeText(cleaned);
    } catch {
      const lines = content
        .split('\n')
        .map(line => {
          let cleaned = line.trim();
          cleaned = cleaned.replace(/^[-*]\s/, '');
          cleaned = cleaned.replace(/^#+\s/, '');
          cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
          cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
          return cleaned;
        })
        .filter(line => line.length > 0);

      return this.normalizeText(lines.join('\n'));
    }
  }

  private static drawTextBlock(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    fontSize: number,
    font: PDFFont,
    color: { r: number; g: number; b: number }
  ): number {
    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;
    const lineHeight = fontSize * 1.5;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x,
          y: currentY,
          size: fontSize,
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
      page.drawText(currentLine, {
        x,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(color.r, color.g, color.b),
      });
      currentY -= lineHeight;
    }

    return currentY;
  }

  private static async renderCard(
    pdfDoc: PDFDocument,
    currentPage: PDFPage,
    card: AnalysisCardData,
    yPosition: number,
    theme: 'dark' | 'light',
    fonts: { regular: PDFFont; bold: PDFFont }
  ): Promise<{ page: PDFPage; yPosition: number }> {
    const colors = PDF_COLORS[theme];
    const pageWidth = currentPage.getWidth();
    const pageHeight = currentPage.getHeight();
    const margin = 50;
    const cardPadding = 20;
    const maxContentWidth = pageWidth - 2 * margin - 2 * cardPadding;

    let page = currentPage;
    let currentY = yPosition;

    if (currentY < 150) {
      page = pdfDoc.addPage(PageSizes.A4);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(colors.background.r, colors.background.g, colors.background.b),
      });
      currentY = pageHeight - 60;
    }

    const analysisColor = ANALYSIS_COLORS[card.order] || colors.accent;
    const analysisSymbol = ANALYSIS_SYMBOLS[card.order] || '\u25A0';

    const badgeWidth = 30;
    const badgeHeight = 24;
    const badgeX = margin;
    const badgeY = currentY - badgeHeight;

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: rgb(analysisColor.r, analysisColor.g, analysisColor.b),
      borderRadius: 4,
    });

    page.drawText(analysisSymbol, {
      x: badgeX + 10,
      y: badgeY + 7,
      size: 12,
      font: fonts.bold,
      color: rgb(1, 1, 1),
    });

    const titleX = margin + badgeWidth + 10;
    const titleY = currentY - 18;
    page.drawText(this.normalizeText(`${card.order}. ${card.title}`), {
      x: titleX,
      y: titleY,
      size: 14,
      font: fonts.bold,
      color: rgb(analysisColor.r, analysisColor.g, analysisColor.b),
    });

    currentY = badgeY - 15;

    const cleanedContent = this.cleanContent(card.content);
    const contentLines = cleanedContent.split('\n').filter(line => line.trim().length > 0);

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];

      if (currentY < 80) {
        page = pdfDoc.addPage(PageSizes.A4);
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: rgb(colors.background.r, colors.background.g, colors.background.b),
        });
        currentY = pageHeight - 60;
      }

      currentY = this.drawTextBlock(
        page,
        line,
        margin,
        currentY,
        maxContentWidth,
        9,
        fonts.regular,
        colors.textSecondary
      );

      currentY -= 5;
    }

    return { page, yPosition: currentY - 20 };
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

    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: rgb(colors.background.r, colors.background.g, colors.background.b),
    });

    let currentY = pageHeight - 60;

    try {
      const logoBytes = await this.loadLogo(theme);
      if (logoBytes) {
        try {
          const logoImage = await pdfDoc.embedPng(logoBytes);
          const logoHeight = 70;
          const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
          const logoX = (pageWidth - logoWidth) / 2;

          page.drawImage(logoImage, {
            x: logoX,
            y: currentY - logoHeight,
            width: logoWidth,
            height: logoHeight,
          });

          currentY -= logoHeight + 35;
        } catch (error) {
          currentY -= 35;
        }
      } else {
        currentY -= 35;
      }
    } catch (error) {
      currentY -= 35;
    }

    const title = this.normalizeText('Wis Legal Analise de Processo');
    const titleWidth = boldFont.widthOfTextAtSize(title, 26);
    const titleX = (pageWidth - titleWidth) / 2;

    page.drawText(title, {
      x: titleX,
      y: currentY,
      size: 26,
      font: boldFont,
      color: rgb(colors.textPrimary.r, colors.textPrimary.g, colors.textPrimary.b),
    });
    currentY -= 35;

    const subtitle = this.normalizeText(processoName);
    const maxSubtitleWidth = Math.min(boldFont.widthOfTextAtSize(subtitle, 14), pageWidth - 100);

    if (boldFont.widthOfTextAtSize(subtitle, 14) > pageWidth - 100) {
      const maxNameWidth = pageWidth - 100;
      currentY = this.drawTextBlock(
        page,
        subtitle,
        50,
        currentY,
        maxNameWidth,
        14,
        regularFont,
        colors.textSecondary
      );
    } else {
      const subtitleWidth = regularFont.widthOfTextAtSize(subtitle, 14);
      const subtitleX = (pageWidth - subtitleWidth) / 2;

      page.drawText(subtitle, {
        x: subtitleX,
        y: currentY,
        size: 14,
        font: regularFont,
        color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
      });
      currentY -= 25;
    }
    currentY -= 40;

    const cardsData = this.extractAnalysisData(analysisResults);

    for (const card of cardsData) {
      const result = await this.renderCard(
        pdfDoc,
        page,
        card,
        currentY,
        theme,
        { regular: regularFont, bold: boldFont }
      );

      page = result.page;
      currentY = result.yPosition;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const allPages = pdfDoc.getPages();
    allPages.forEach(p => {
      p.drawText(this.normalizeText(`Gerado em: ${dateStr}`), {
        x: 50,
        y: 30,
        size: 8,
        font: regularFont,
        color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
      });
      p.drawText(this.normalizeText('Wis Legal (c) 2024'), {
        x: pageWidth - 150,
        y: 30,
        size: 8,
        font: regularFont,
        color: rgb(colors.textSecondary.r, colors.textSecondary.g, colors.textSecondary.b),
      });
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  static generateFileName(processoName: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).replace(/\//g, '-');

    const cleanName = processoName
      .replace(/\.pdf$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);

    return `wis_legal_${cleanName}_analise_${dateStr}.pdf`;
  }
}
