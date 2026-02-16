import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const MAX_CHARS_PER_LINE = 85;

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
      console.error('[generate-analysis-pdf] processo_id nao fornecido no body:', body);
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
      console.error('[generate-analysis-pdf] Processo nao encontrado:', processo_id);
      return new Response(
        JSON.stringify({ error: 'Processo nao encontrado', processo_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: results, error: resultsError } = await supabase
      .from('analysis_results')
      .select('prompt_title, result_content')
      .eq('processo_id', processo_id)
      .eq('status', 'completed')
      .order('execution_order');

    if (resultsError || !results || results.length === 0) {
      console.error('[generate-analysis-pdf] Nenhum resultado encontrado');
      return new Response(
        JSON.stringify({ error: 'Nenhum resultado de analise encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-analysis-pdf] Gerando PDF com ${results.length} secoes`);

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const addPage = () => {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      return { page, y: PAGE_HEIGHT - MARGIN };
    };

    let { page, y } = addPage();

    const drawText = (text: string, options: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}) => {
      const { size = 10, bold = false, color = [0, 0, 0], indent = 0 } = options;
      const selectedFont = bold ? fontBold : font;
      const x = MARGIN + indent;

      if (y < MARGIN + LINE_HEIGHT * 2) {
        const newPage = addPage();
        page = newPage.page;
        y = newPage.y;
      }

      const lines = wrapText(text, MAX_CHARS_PER_LINE - Math.floor(indent / 7));
      for (const line of lines) {
        if (y < MARGIN + LINE_HEIGHT) {
          const newPage = addPage();
          page = newPage.page;
          y = newPage.y;
        }
        page.drawText(line, {
          x,
          y,
          size,
          font: selectedFont,
          color: rgb(color[0], color[1], color[2]),
        });
        y -= LINE_HEIGHT;
      }
    };

    const drawTitle = (text: string) => {
      y -= 10;
      drawText(text, { size: 14, bold: true, color: [0.12, 0.25, 0.69] });
      y -= 5;
    };

    const drawSubtitle = (text: string) => {
      drawText(text, { size: 11, bold: true, color: [0.22, 0.26, 0.32] });
    };

    drawText('Analise Juridica Completa', { size: 20, bold: true });
    y -= 10;
    drawText(`Processo: ${processo.file_name || 'N/A'}`, { size: 12 });
    drawText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, { size: 10 });
    y -= 20;

    for (const result of results) {
      const title = result.prompt_title || 'Secao';

      const newPage = addPage();
      page = newPage.page;
      y = newPage.y;

      drawTitle(title);
      y -= 10;

      try {
        const content = typeof result.result_content === 'string'
          ? JSON.parse(result.result_content)
          : result.result_content;

        renderContent(content, 0);
      } catch {
        if (result.result_content) {
          const textContent = typeof result.result_content === 'string'
            ? result.result_content
            : JSON.stringify(result.result_content);
          drawText(textContent.substring(0, 3000));
        } else {
          drawText('Conteudo nao disponivel');
        }
      }
    }

    function renderContent(content: unknown, depth: number) {
      if (!content) return;
      const indent = depth * 15;

      if (Array.isArray(content)) {
        for (const item of content) {
          if (typeof item === 'string') {
            drawText(`- ${item}`, { indent });
          } else if (typeof item === 'object' && item !== null) {
            renderContent(item, depth);
          }
        }
      } else if (typeof content === 'object' && content !== null) {
        const obj = content as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'content' || key === 'texto' || key === 'descricao' || key === 'description') {
            if (typeof value === 'string') {
              drawText(value, { indent });
              y -= 5;
            } else if (Array.isArray(value)) {
              renderContent(value, depth);
            }
          } else if (key === 'titulo' || key === 'title' || key === 'nome' || key === 'name') {
            if (typeof value === 'string') {
              drawSubtitle(value);
              y -= 3;
            }
          } else if (key === 'items' || key === 'itens' || key === 'list' || key === 'lista') {
            renderContent(value, depth + 1);
          } else if (typeof value === 'object' && value !== null) {
            drawText(`${formatKey(key)}:`, { bold: true, indent });
            renderContent(value, depth + 1);
            y -= 5;
          } else if (value !== null && value !== undefined && value !== '') {
            drawText(`${formatKey(key)}: ${String(value)}`, { indent });
          }
        }
      } else if (typeof content === 'string') {
        drawText(content, { indent });
      }
    }

    const pdfBytes = await pdfDoc.save();

    console.log(`[generate-analysis-pdf] PDF gerado: ${pdfBytes.length} bytes`);

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

    const { error: updateError } = await supabase
      .from('processos')
      .update({ analysis_pdf_url: pdfUrl })
      .eq('id', processo_id);

    if (updateError) {
      console.error('[generate-analysis-pdf] Erro ao salvar URL no banco:', updateError);
    }

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

function sanitizeForPdf(text: string): string {
  let normalized = text.normalize('NFC');

  const replacements: Record<string, string> = {
    '\u0301': '',
    '\u0300': '',
    '\u0302': '',
    '\u0303': '',
    '\u0308': '',
    '\u0327': '',
    '\u2018': "'",
    '\u2019': "'",
    '\u201C': '"',
    '\u201D': '"',
    '\u2013': '-',
    '\u2014': '-',
    '\u2026': '...',
    '\u00A0': ' ',
    '\u200B': '',
    '\u200C': '',
    '\u200D': '',
    '\uFEFF': '',
    '\u00AD': '',
    '\u2022': '-',
    '\u2023': '-',
    '\u2043': '-',
    '\u00B7': '-',
  };

  for (const [char, replacement] of Object.entries(replacements)) {
    normalized = normalized.split(char).join(replacement);
  }

  normalized = normalized.replace(/[\u0300-\u036f]/g, '');

  let result = '';
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code < 256) {
      result += normalized[i];
    } else if (code >= 0x1F00 && code <= 0x1FFF) {
      result += '';
    } else {
      result += ' ';
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const sanitized = sanitizeForPdf(text);
  const cleanText = sanitized.replace(/[\n\r]+/g, ' ').trim();
  const words = cleanText.split(' ');
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.length > maxChars ? word.substring(0, maxChars) : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
