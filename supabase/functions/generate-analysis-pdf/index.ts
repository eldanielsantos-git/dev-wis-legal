import { createClient } from 'jsr:@supabase/supabase-js@2';
import PDFDocument from 'npm:pdfkit@0.15.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AnalysisSection {
  title: string;
  content: any;
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
      console.error('[generate-analysis-pdf] processo_id não fornecido no body:', body);
      return new Response(
        JSON.stringify({ error: 'processo_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('numero_processo, created_at')
      .eq('id', processo_id)
      .single();

    console.log('[generate-analysis-pdf] Query resultado - processo:', processo, 'error:', processoError);

    if (processoError || !processo) {
      console.error('[generate-analysis-pdf] Processo não encontrado:', processo_id, 'error:', processoError);
      return new Response(
        JSON.stringify({ error: 'Processo não encontrado', processo_id, db_error: processoError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: results, error: resultsError } = await supabase
      .from('analysis_results')
      .select('view_name, result_json')
      .eq('processo_id', processo_id)
      .order('view_name');

    if (resultsError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar análise' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Uint8Array[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));

    const pdfGenerated = new Promise<Uint8Array>((resolve, reject) => {
      doc.on('end', () => {
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(result);
      });
      doc.on('error', reject);
    });

    doc.fontSize(20).text('Análise Jurídica Completa', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Processo: ${processo.numero_processo || 'N/A'}`, { align: 'center' });
    doc.fontSize(10).text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);

    const viewTitles: Record<string, string> = {
      'visao-geral-processo': 'Visão Geral do Processo',
      'estrategias-juridicas': 'Estratégias Jurídicas',
      'riscos-alertas': 'Riscos e Alertas',
      'balanco-financeiro': 'Balanço Financeiro',
      'comunicacoes-prazos': 'Comunicações e Prazos',
      'mapa-preclusoes': 'Mapa de Preclusões',
      'admissibilidade-recursal': 'Admissibilidade Recursal',
      'conclusoes-perspectivas': 'Conclusões e Perspectivas',
      'resumo-estrategico': 'Resumo Estratégico'
    };

    for (const result of results) {
      const title = viewTitles[result.view_name] || result.view_name;

      doc.addPage();
      doc.fontSize(16).fillColor('#1e40af').text(title, { underline: true });
      doc.moveDown();
      doc.fontSize(10).fillColor('#000000');

      try {
        const content = typeof result.result_json === 'string'
          ? JSON.parse(result.result_json)
          : result.result_json;

        addContentToDoc(doc, content);
      } catch (e) {
        doc.text(`Erro ao processar conteúdo desta seção: ${e.message}`);
      }
    }

    doc.end();

    const pdfBuffer = await pdfGenerated;

    const fileName = `${processo_id}/analysis.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('processos')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error('Erro ao fazer upload do PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar PDF no storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: urlData } = supabase.storage
      .from('processos')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        success: true,
        pdf_url: urlData.publicUrl,
        file_path: fileName
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function addContentToDoc(doc: any, content: any, indent = 0) {
  if (!content) return;

  const indentStr = '  '.repeat(indent);

  if (Array.isArray(content)) {
    content.forEach((item, index) => {
      if (typeof item === 'string') {
        doc.text(`${indentStr}• ${item}`, { indent: indent * 20 });
      } else if (typeof item === 'object') {
        addContentToDoc(doc, item, indent);
      }
    });
  } else if (typeof content === 'object') {
    for (const [key, value] of Object.entries(content)) {
      if (key === 'content' || key === 'texto' || key === 'descricao') {
        if (typeof value === 'string') {
          doc.text(`${indentStr}${value}`, { indent: indent * 20 });
          doc.moveDown(0.5);
        } else if (Array.isArray(value)) {
          addContentToDoc(doc, value, indent);
        }
      } else if (key === 'titulo' || key === 'title' || key === 'nome') {
        doc.fontSize(12).fillColor('#1e40af').text(`${indentStr}${value}`, { indent: indent * 20 });
        doc.fontSize(10).fillColor('#000000');
        doc.moveDown(0.3);
      } else if (typeof value === 'object') {
        doc.fontSize(11).fillColor('#374151').text(`${indentStr}${formatKey(key)}:`, { indent: indent * 20 });
        doc.fontSize(10).fillColor('#000000');
        addContentToDoc(doc, value, indent + 1);
        doc.moveDown(0.3);
      } else if (value !== null && value !== undefined) {
        doc.text(`${indentStr}${formatKey(key)}: ${value}`, { indent: indent * 20 });
      }
    }
  } else if (typeof content === 'string') {
    doc.text(`${indentStr}${content}`, { indent: indent * 20 });
  }
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
