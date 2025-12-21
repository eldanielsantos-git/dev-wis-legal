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

export class PDFExportService {
  private static normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7F]/g, '');
  }

  private static async loadLogo(theme: 'dark' | 'light'): Promise<Uint8Array | null> {
    try {
      console.log('[PDF] Carregando logo:', LOGO_URLS[theme]);
      const response = await fetch(LOGO_URLS[theme], { mode: 'cors' });
      if (!response.ok) {
        console.warn('[PDF] Failed to load logo:', response.statusText);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      console.log('[PDF] Logo carregado com sucesso, tamanho:', arrayBuffer.byteLength);
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.warn('[PDF] Logo não disponível, continuando sem logo:', error);
      return null;
    }
  }

  private static extractAnalysisData(analysisResults: AnalysisResult[]): AnalysisCardData[] {
    console.log('[PDF] Extraindo dados de análise, total de resultados:', analysisResults.length);
    const extracted = analysisResults
      .filter(result => result.status === 'completed' && result.result_content)
      .sort((a, b) => a.execution_order - b.execution_order)
      .map(result => ({
        order: result.execution_order,
        title: result.prompt_title,
        content: result.result_content,
      }));
    console.log('[PDF] Extraídos', extracted.length, 'cards de análise');
    return extracted;
  }

  private static cleanContent(content: string): string {
    try {
      if (!content || content.trim() === '') {
        return this.normalizeText('Conteudo nao disponivel');
      }

      const parsed = JSON.parse(content);

      if (typeof parsed === 'string') {
        return this.normalizeText(parsed.substring(0, 500));
      }

      if (typeof parsed === 'object' && parsed !== null) {
        const jsonStr = JSON.stringify(parsed, null, 2);
        return this.normalizeText(jsonStr.substring(0, 500));
      }

      return this.normalizeText(content.substring(0, 500));
    } catch {
      return this.normalizeText(content.substring(0, 500));
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
    page: PDFPage,
    card: AnalysisCardData,
    yPosition: number,
    theme: 'dark' | 'light',
    fonts: { regular: PDFFont; bold: PDFFont }
  ): Promise<number> {
    const colors = PDF_COLORS[theme];
    const pageWidth = page.getWidth();
    const margin = 50;
    const cardPadding = 20;
    const maxContentWidth = pageWidth - 2 * margin - 2 * cardPadding;

    const titleHeight = fonts.bold.heightAtSize(16);
    const cardMinHeight = 80;

    page.drawRectangle({
      x: margin,
      y: yPosition - cardMinHeight,
      width: pageWidth - 2 * margin,
      height: cardMinHeight,
      color: rgb(colors.cardBg.r, colors.cardBg.g, colors.cardBg.b),
      borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
      borderWidth: 1,
    });

    const titleY = yPosition - cardPadding - titleHeight;
    page.drawText(this.normalizeText(`${card.order}. ${card.title}`), {
      x: margin + cardPadding,
      y: titleY,
      size: 16,
      font: fonts.bold,
      color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
    });

    const cleanedContent = this.cleanContent(card.content);
    const contentLines = cleanedContent.split('\n').slice(0, 3);
    const contentPreview = contentLines.join(' ').substring(0, 200) + '...';

    const contentY = titleY - 30;
    const finalY = this.drawTextBlock(
      page,
      contentPreview,
      margin + cardPadding,
      contentY,
      maxContentWidth,
      10,
      fonts.regular,
      colors.textSecondary
    );

    return finalY - 40;
  }

  static async generatePDF(
    processoName: string,
    analysisResults: AnalysisResult[],
    theme: 'dark' | 'light'
  ): Promise<Uint8Array> {
    console.log('[PDF] Iniciando geração de PDF');
    console.log('[PDF] Nome do processo:', processoName);
    console.log('[PDF] Tema:', theme);
    console.log('[PDF] Número de resultados:', analysisResults.length);

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
          const logoHeight = 40;
          const logoWidth = (logoImage.width / logoImage.height) * logoHeight;

          page.drawImage(logoImage, {
            x: 50,
            y: currentY - logoHeight,
            width: logoWidth,
            height: logoHeight,
          });

          console.log('[PDF] Logo adicionado com sucesso');
          currentY -= logoHeight + 30;
        } catch (error) {
          console.warn('[PDF] Erro ao incorporar logo, continuando sem logo:', error);
          currentY -= 30;
        }
      } else {
        console.log('[PDF] Logo não disponível, continuando sem logo');
        currentY -= 30;
      }
    } catch (error) {
      console.warn('[PDF] Erro ao carregar logo, continuando sem logo:', error);
      currentY -= 30;
    }

    page.drawText(this.normalizeText('Wis Legal Analise de Processo'), {
      x: 50,
      y: currentY,
      size: 24,
      font: boldFont,
      color: rgb(colors.textPrimary.r, colors.textPrimary.g, colors.textPrimary.b),
    });
    currentY -= 40;

    const maxNameWidth = pageWidth - 100;
    currentY = this.drawTextBlock(
      page,
      this.normalizeText(processoName),
      50,
      currentY,
      maxNameWidth,
      14,
      regularFont,
      colors.textSecondary
    );
    currentY -= 40;

    const cardsData = this.extractAnalysisData(analysisResults);

    console.log('[PDF] Renderizando', cardsData.length, 'cards');

    for (const card of cardsData) {
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

      currentY = await this.renderCard(
        page,
        card,
        currentY,
        theme,
        { regular: regularFont, bold: boldFont }
      );
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

    console.log('[PDF] Salvando documento PDF');
    const pdfBytes = await pdfDoc.save();
    console.log('[PDF] PDF gerado com sucesso, tamanho:', pdfBytes.length, 'bytes');
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
