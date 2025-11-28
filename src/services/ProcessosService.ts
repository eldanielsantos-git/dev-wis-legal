import { supabase } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import type { Processo, Pagina } from '../lib/supabase';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const MAX_PDF_SIZE_FOR_INLINE = 50 * 1024 * 1024;
const CHUNK_SIZE = 40 * 1024 * 1024;

async function countPdfPages(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    throw new Error('Erro ao contar páginas do PDF');
  }
}

export class ProcessosService {

  private static sanitizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0000-\u001f\u007f-\u009f/\\?%*:|"<>]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private static async convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  private static async uploadFileToStorage(file: File): Promise<{
    filePath: string;
    fileUrl: string;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const sanitizedFileName = this.sanitizeFileName(file.name);
    const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;

    console.log('📤 Fazendo backup no Storage...', { fileName });

    const { data, error } = await supabase.storage
      .from('processos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Erro no upload:', error);
      throw new Error(`Falha no upload: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('processos')
      .getPublicUrl(fileName);

    console.log('✅ Backup concluído', { filePath: data.path });

    return {
      filePath: data.path,
      fileUrl: publicUrlData.publicUrl
    };
  }

  private static async storeBase64InDatabase(
    processoId: string,
    base64Data: string,
    fileSize: number
  ): Promise<void> {
    console.log('💾 Armazenando PDF em base64 no banco...');

    if (fileSize <= MAX_PDF_SIZE_FOR_INLINE) {
      await supabase
        .from('processos')
        .update({
          pdf_base64: base64Data,
          pdf_size_bytes: fileSize,
          is_chunked: false,
          total_chunks: 0
        })
        .eq('id', processoId);

      console.log('✅ PDF armazenado inline (não chunkeado)');
    } else {
      const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
      console.log(`📦 Dividindo PDF em ${totalChunks} chunks...`);

      const chunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, base64Data.length);
        const chunkData = base64Data.substring(start, end);

        chunks.push({
          processo_id: processoId,
          chunk_number: i + 1,
          chunk_data: chunkData,
          chunk_size_bytes: chunkData.length
        });
      }

      const { error: chunksError } = await supabase
        .from('pdf_chunks')
        .insert(chunks);

      if (chunksError) {
        throw new Error(`Erro ao salvar chunks: ${chunksError.message}`);
      }

      await supabase
        .from('processos')
        .update({
          pdf_base64: null,
          pdf_size_bytes: fileSize,
          is_chunked: true,
          total_chunks: totalChunks
        })
        .eq('id', processoId);

      console.log(`✅ ${totalChunks} chunks armazenados com sucesso`);
    }
  }

  static async createProcesso(
    fileName: string,
    filePath: string,
    fileUrl: string,
    fileSize: number,
    totalPages: number
  ): Promise<Processo> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data, error } = await supabase
      .from('processos')
      .insert({
        file_name: fileName,
        file_path: filePath,
        file_url: fileUrl,
        file_size: fileSize,
        status: 'created',
        user_id: user.id,
        transcricao: { totalPages }
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar processo:', error);
      throw new Error('Não foi possível criar o processo');
    }

    return data;
  }

  static async uploadAndStartProcessing(
    file: File,
    onProcessoCreated?: (processoId: string) => void
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const tempProcessoId = crypto.randomUUID();

    const { data: tempProcesso, error: tempError } = await supabase
      .from('processos')
      .insert({
        id: tempProcessoId,
        file_name: file.name,
        file_size: file.size,
        status: 'uploading',
        user_id: user.id,
      })
      .select()
      .single();

    if (tempError) {
      console.error('Erro ao criar processo temporário:', tempError);
      throw new Error('Não foi possível criar o processo');
    }

    if (onProcessoCreated) {
      onProcessoCreated(tempProcessoId);
    }

    try {
      console.log('📤 Iniciando upload e processamento...');

      const totalPages = await countPdfPages(file);
      console.log(`📄 PDF tem ${totalPages} páginas`);

      const { filePath, fileUrl } = await this.uploadFileToStorage(file);

      const base64Data = await this.convertFileToBase64(file);
      await this.storeBase64InDatabase(tempProcessoId, base64Data, file.size);

      await supabase
        .from('processos')
        .update({
          file_path: filePath,
          file_url: fileUrl,
          status: 'created',
          transcricao: { totalPages }
        })
        .eq('id', tempProcessoId);

      console.log('✅ Processo criado, iniciando análise...');
      await this.startAnalysis(tempProcessoId);

      return tempProcessoId;
    } catch (error: any) {
      console.error('❌ Erro no upload e processamento:', error);

      await supabase
        .from('processos')
        .update({
          status: 'error',
          last_error_type: error.message || 'Erro no upload'
        })
        .eq('id', tempProcessoId);

      throw error;
    }
  }

  static async startAnalysis(processoId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    console.log('🚀 Iniciando análise para processo:', processoId);

    const response = await fetch(`${supabaseUrl}/functions/v1/start-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ processo_id: processoId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao iniciar análise');
    }

    console.log('✅ Análise iniciada com sucesso');

    // Start processing in background (don't await to not block the UI)
    this.processPromptsSequentially(processoId).catch(error => {
      console.error('❌ Erro no processamento em background:', error);
    });
  }

  private static async processPromptsSequentially(processoId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    console.log('🔄 Iniciando processamento sequencial de prompts para:', processoId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ Usuário não autenticado - não é possível processar prompts');
      throw new Error('Usuário não autenticado');
    }

    console.log('✅ Sessão válida obtida, iniciando loop de processamento');

    let promptCount = 0;

    while (true) {
      try {
        promptCount++;
        console.log(`\n📤 Chamando process-next-prompt (tentativa ${promptCount})...`);

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          console.error('❌ Sessão expirou - tentando renovar...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            console.error('❌ Não foi possível renovar a sessão');
            break;
          }
          console.log('✅ Sessão renovada com sucesso');
        }

        const validSession = currentSession || (await supabase.auth.getSession()).data.session;
        if (!validSession) {
          console.error('❌ Nenhuma sessão válida disponível');
          break;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/process-next-prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validSession.access_token}`,
          },
          body: JSON.stringify({ processo_id: processoId }),
        });

        console.log(`📥 Resposta recebida: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ Erro ao processar prompt:', errorData);
          break;
        }

        const result = await response.json();
        console.log('📊 Resultado:', result);

        if (result.completed) {
          console.log('✅ Todos os prompts foram processados');
          break;
        }

        console.log(`✓ Prompt "${result.prompt_title}" concluído em ${result.execution_time_ms}ms usando ${result.model_used}`);
        console.log(`🔄 Continuando para próximo prompt...`);
      } catch (error) {
        console.error('❌ Erro no processamento sequencial:', error);
        break;
      }
    }

    console.log(`\n🏁 Processamento finalizado após ${promptCount} chamadas`);
  }

  static countPdfPages = countPdfPages;

  static async getAllProcessos(): Promise<Processo[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.is_admin || false;

    let query = supabase
      .from('processos')
      .select(`
        id,
        file_name,
        file_path,
        file_url,
        file_size,
        status,
        transcricao,
        user_id,
        created_at,
        updated_at,
        gemini_file_uri,
        gemini_file_name,
        gemini_file_state,
        pdf_size_bytes,
        is_chunked,
        total_chunks,
        analysis_completed_at,
        analysis_started_at,
        current_prompt_number,
        total_prompts,
        tokens_consumed,
        current_llm_model_name,
        current_llm_model_id,
        last_error_type,
        visao_geral_processo,
        resumo_estrategico,
        comunicacoes_prazos,
        admissibilidade_recursal,
        estrategias_juridicas,
        riscos_alertas,
        balanco_financeiro,
        mapa_preclusoes,
        conclusoes_perspectivas,
        user_profile:user_profiles!processos_user_id_user_profiles_fkey(first_name, last_name, email)
      `);

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar processos:', error);
      throw new Error('Não foi possível carregar os processos');
    }

    return data || [];
  }

  static getProcessos = ProcessosService.getAllProcessos;

  static async getProcessoById(id: string): Promise<Processo | null> {
    const { data, error } = await supabase
      .from('processos')
      .select(`
        id,
        file_name,
        file_path,
        file_url,
        file_size,
        status,
        transcricao,
        user_id,
        created_at,
        updated_at,
        gemini_file_uri,
        gemini_file_name,
        gemini_file_state,
        pdf_size_bytes,
        is_chunked,
        total_chunks,
        analysis_completed_at,
        analysis_started_at,
        current_prompt_number,
        total_prompts,
        tokens_consumed,
        current_llm_model_name,
        current_llm_model_id,
        llm_model_switching,
        last_error_type,
        visao_geral_processo,
        resumo_estrategico,
        comunicacoes_prazos,
        admissibilidade_recursal,
        estrategias_juridicas,
        riscos_alertas,
        balanco_financeiro,
        mapa_preclusoes,
        conclusoes_perspectivas,
        user_profile:user_profiles(first_name, last_name, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar processo:', error);
      return null;
    }

    return data;
  }

  static async deleteProcesso(id: string): Promise<void> {
    const processo = await this.getProcessoById(id);
    if (!processo) {
      throw new Error('Processo não encontrado');
    }

    if (processo.file_path) {
      const { error: storageError } = await supabase.storage
        .from('processos')
        .remove([processo.file_path]);

      if (storageError) {
        console.error('Erro ao deletar arquivo:', storageError);
      }
    }

    const { error } = await supabase
      .from('processos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar processo:', error);
      throw new Error('Não foi possível deletar o processo');
    }

    console.log('✅ Processo deletado com sucesso:', id);
  }

  static async updateProcessoName(id: string, newName: string): Promise<void> {
    const { error } = await supabase
      .from('processos')
      .update({ file_name: newName })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar nome:', error);
      throw new Error('Não foi possível atualizar o nome do processo');
    }

    console.log('✅ Nome atualizado com sucesso');
  }

  static async getPaginasText(processoId: string): Promise<Pagina[]> {
    const { data, error } = await supabase
      .from('paginas')
      .select('*')
      .eq('processo_id', processoId)
      .order('page_number', { ascending: true });

    if (error) {
      console.error('Erro ao buscar páginas:', error);
      return [];
    }

    return data || [];
  }

  static subscribeToProcessoChanges(
    processoId: string,
    callback: (processo: Processo) => void
  ) {
    const channel = supabase
      .channel(`processo_${processoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'processos',
          filter: `id=eq.${processoId}`,
        },
        (payload) => {
          callback(payload.new as Processo);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static async subscribeToProcessos(
    userId: string,
    callback: (processos: Processo[]) => void
  ) {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    const isAdmin = userProfile?.is_admin || false;

    const subscriptionConfig = {
      event: '*' as const,
      schema: 'public',
      table: 'processos',
      ...(isAdmin ? {} : { filter: `user_id=eq.${userId}` })
    };

    const channel = supabase
      .channel(`processos_user_${userId}`)
      .on(
        'postgres_changes',
        subscriptionConfig,
        async () => {
          const processos = await this.getAllProcessos();
          callback(processos);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  static async uploadAndProcessChunkedPDF(
    file: File,
    totalPages: number,
    onProcessoCreated?: (processoId: string) => void
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const PAGES_PER_CHUNK = 500;
    const totalChunks = Math.ceil(totalPages / PAGES_PER_CHUNK);

    console.log(`📦 PDF grande detectado: ${totalPages} páginas, será dividido em ${totalChunks} chunks`);

    const processoId = crypto.randomUUID();
    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .insert({
        id: processoId,
        file_name: file.name,
        file_size: file.size,
        status: 'uploading',
        user_id: user.id,
        is_chunked: true,
        total_chunks_count: totalChunks,
        current_processing_chunk: 0,
      })
      .select()
      .single();

    if (processoError) {
      console.error('Erro ao criar processo:', processoError);
      throw new Error('Não foi possível criar o processo');
    }

    if (onProcessoCreated) {
      onProcessoCreated(processoId);
    }

    try {
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const startPage = chunkIndex * PAGES_PER_CHUNK;
        const endPage = Math.min(startPage + PAGES_PER_CHUNK, totalPages);

        console.log(`📄 Criando chunk ${chunkIndex + 1}/${totalChunks} (páginas ${startPage + 1}-${endPage})`);

        const chunkDoc = await PDFDocument.create();
        for (let pageNum = startPage; pageNum < endPage; pageNum++) {
          const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
          chunkDoc.addPage(copiedPage);
        }

        const chunkBytes = await chunkDoc.save();
        const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });
        const chunkFileName = `chunk_${chunkIndex + 1}_of_${totalChunks}.pdf`;
        const chunkFile = new File([chunkBlob], chunkFileName, { type: 'application/pdf' });

        console.log(`📤 Fazendo upload do chunk ${chunkIndex + 1}/${totalChunks}...`);
        const sanitizedFileName = this.sanitizeFileName(file.name);
        const chunkPath = `${user.id}/${Date.now()}-${sanitizedFileName.replace('.pdf', '')}_chunk${chunkIndex + 1}.pdf`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('processos')
          .upload(chunkPath, chunkFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Erro no upload do chunk ${chunkIndex + 1}: ${uploadError.message}`);
        }

        await supabase.from('process_chunks').insert({
          processo_id: processoId,
          chunk_index: chunkIndex + 1,
          total_chunks: totalChunks,
          start_page: startPage + 1,
          end_page: endPage,
          pages_count: endPage - startPage,
          file_path: uploadData.path,
          file_size: chunkFile.size,
          status: 'ready',
        });

        console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} criado com sucesso`);
      }

      await supabase
        .from('processos')
        .update({
          status: 'created',
          transcricao: { totalPages, totalChunks }
        })
        .eq('id', processoId);

      console.log(`✅ Processo chunkeado criado com sucesso: ${processoId}`);

      console.log('✅ Processo criado, iniciando análise...');
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-analysis`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processo_id: processoId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Falha ao iniciar análise');
      }

      console.log('✅ Análise iniciada com sucesso');
      console.log('📝 start-analysis irá disparar process-next-prompt automaticamente');

      return processoId;

    } catch (error) {
      await supabase
        .from('processos')
        .update({ status: 'error' })
        .eq('id', processoId);

      throw error;
    }
  }

  static async uploadAndStartComplexProcessing(
    file: File,
    totalPages: number,
    onProcessoCreated?: (processoId: string) => void
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { splitPDFIntoChunksWithOverlap, getChunkConfiguration } = await import('../utils/pdfSplitter');

    const config = getChunkConfiguration(totalPages);
    console.log(`📦 PDF complexo detectado: ${totalPages} páginas, ${config.totalChunks} chunks com ${config.chunkSize} páginas cada`);
    console.log(`⏱️ Tempo estimado: ~${config.estimatedProcessingTimeMinutes} minutos`);

    const chunks = await splitPDFIntoChunksWithOverlap(file);
    console.log(`✅ PDF dividido em ${chunks.length} chunks com overlap de 50 páginas`);

    const processoId = crypto.randomUUID();
    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .insert({
        id: processoId,
        file_name: file.name,
        file_size: file.size,
        status: 'uploading',
        user_id: user.id,
        is_chunked: true,
        total_chunks_count: chunks.length,
        current_processing_chunk: 0,
      })
      .select()
      .single();

    if (processoError) {
      console.error('❌ Erro ao criar processo:', processoError);
      throw new Error('Não foi possível criar o processo');
    }

    if (onProcessoCreated) {
      onProcessoCreated(processoId);
    }

    console.log('🚀 Upload de chunks iniciado - você pode navegar livremente durante o processo');
    console.log('📊 O progresso será monitorado automaticamente');

    // Função assíncrona para upload de chunks em background
    const uploadChunksInBackground = async () => {
      try {
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`📤 Fazendo upload do chunk ${i + 1}/${chunks.length}...`);

          const sanitizedFileName = this.sanitizeFileName(file.name);
          const timestamp = Date.now();
          const chunkPath = `${user.id}/${timestamp}-${sanitizedFileName.replace('.pdf', '')}_chunk${i + 1}.pdf`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('processos')
            .upload(chunkPath, chunk.file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error(`❌ Erro no upload do chunk ${i + 1}:`, uploadError);
            throw new Error(`Erro no upload do chunk ${i + 1}: ${uploadError.message}`);
          }

          const { error: chunkError } = await supabase.from('process_chunks').insert({
            processo_id: processoId,
            chunk_index: i + 1,
            total_chunks: chunks.length,
            start_page: chunk.startPage,
            end_page: chunk.endPage,
            pages_count: chunk.endPage - chunk.startPage + 1,
            overlap_start_page: chunk.overlapStartPage,
            overlap_end_page: chunk.overlapEndPage,
            file_path: uploadData.path,
            file_size: chunk.file.size,
            status: 'ready',
          });

          if (chunkError) {
            console.error(`❌ Erro ao salvar chunk ${i + 1}:`, chunkError);
            throw new Error(`Erro ao salvar chunk ${i + 1}: ${chunkError.message}`);
          }

          console.log(`✅ Chunk ${i + 1}/${chunks.length} enviado com sucesso`);
        }

        // Todos os chunks foram enviados
        await supabase
          .from('processos')
          .update({
            status: 'created',
            transcricao: { totalPages, totalChunks: chunks.length, chunkSize: config.chunkSize }
          })
          .eq('id', processoId);

        console.log(`✅ Processo complexo criado: ${processoId}`);
        console.log('🚀 Iniciando análise complexa...');

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-analysis-complex`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ processo_id: processoId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Falha ao iniciar análise complexa');
        }

        console.log('✅ Análise complexa iniciada com sucesso');
        console.log('📝 Workers processarão chunks sequencialmente com contexto');

      } catch (error) {
        console.error('❌ Erro no upload de chunks:', error);
        await supabase
          .from('processos')
          .update({ status: 'error' })
          .eq('id', processoId);
        throw error;
      }
    };

    // Iniciar upload em background sem aguardar
    uploadChunksInBackground().catch(error => {
      console.error('❌ Erro fatal no upload de chunks:', error);
    });

    // Retornar imediatamente para permitir navegação
    return processoId;
  }
}
