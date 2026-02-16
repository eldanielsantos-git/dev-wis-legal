import { supabase } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import type { Processo, Pagina } from '../lib/supabase';
import { executeWithRetry } from '../utils/supabaseWithRetry';
import { isLargeFile, estimatePageCountFromSize } from '../utils/pdfSplitter';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const LARGE_FILE_SIZE_THRESHOLD = 18 * 1024 * 1024; // 18MB
const PAGE_COUNT_READ_THRESHOLD = 500 * 1024 * 1024; // 500MB - threshold for reading actual page count

async function countPdfPages(file: File): Promise<number> {
  if (file.size >= PAGE_COUNT_READ_THRESHOLD) {
    return estimatePageCountFromSize(file.size);
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return estimatePageCountFromSize(file.size);
  }
}

export class ProcessosService {

  static async resumeInterruptedUpload(processoId: string, onProgress?: (current: number, total: number) => void): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }


    const { data: processo, error: processoError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processoId)
      .single();

    if (processoError || !processo) {
      throw new Error('Processo não encontrado');
    }

    if (!processo.upload_interrupted) {
      return;
    }

    if (!processo.original_file_path) {
      throw new Error('Arquivo original não encontrado');
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('processos')
      .download(processo.original_file_path);

    if (downloadError || !fileData) {
      throw new Error(`Erro ao baixar arquivo original: ${downloadError?.message}`);
    }

    const file = new File([fileData], processo.file_name, { type: 'application/pdf' });

    const { splitPDFIntoChunksWithOverlap } = await import('../utils/pdfSplitter');
    const chunks = await splitPDFIntoChunksWithOverlap(file);

    const startFromChunk = processo.chunks_uploaded_count || 0;

    for (let i = startFromChunk; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (onProgress) {
        onProgress(i, chunks.length);
      }

      const sanitizedFileName = this.sanitizeFileName(file.name);
      const timestamp = Date.now();
      const chunkPath = `${user.id}/${timestamp}-${sanitizedFileName.replace('.pdf', '')}_chunk${i + 1}.pdf`;

      const MAX_RETRIES = 30;
      let uploadData = null;
      let uploadError = null;
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
        const result = await supabase.storage
          .from('processos')
          .upload(chunkPath, chunk.file, {
            cacheControl: '3600',
            upsert: true
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          if (retryCount > 0) {
          }
          break;
        }

        retryCount++;

        if (retryCount < MAX_RETRIES) {
          const backoffSeconds = Math.min(Math.pow(2, retryCount), 300);

          await supabase
            .from('processos')
            .update({
              chunk_retry_count: retryCount,
              current_failed_chunk: i,
              last_chunk_error: uploadError.message,
              upload_interrupted: true
            })
            .eq('id', processoId);

          await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
        }
      }

      if (uploadError) {
        await supabase
          .from('processos')
          .update({
            status: 'error',
            upload_interrupted: true,
            last_chunk_error: `Falha após ${MAX_RETRIES} tentativas: ${uploadError.message}`
          })
          .eq('id', processoId);
        throw new Error(`Erro no upload da parte ${i + 1}: ${uploadError.message}`);
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
        await supabase
          .from('processos')
          .update({ upload_interrupted: true })
          .eq('id', processoId);
        throw new Error(`Erro ao salvar parte ${i + 1}: ${chunkError.message}`);
      }

      await supabase
        .from('processos')
        .update({
          chunks_uploaded_count: i + 1,
          last_chunk_uploaded_at: new Date().toISOString(),
          chunk_retry_count: 0,
          current_failed_chunk: null,
          last_chunk_error: null,
          upload_interrupted: false
        })
        .eq('id', processoId);

    }

    await supabase
      .from('processos')
      .update({
        status: 'created',
        upload_interrupted: false
      })
      .eq('id', processoId);


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

  }

  private static sanitizeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0000-\u001f\u007f-\u009f/\\?%*:|"<>]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
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


    const { data, error } = await supabase.storage
      .from('processos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Falha no upload: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('processos')
      .getPublicUrl(fileName);


    return {
      filePath: data.path,
      fileUrl: publicUrlData.publicUrl
    };
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
        transcricao: { totalPages },
        total_pages: totalPages
      })
      .select()
      .single();

    if (error) {
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
      throw new Error('Não foi possível criar o processo');
    }

    if (onProcessoCreated) {
      onProcessoCreated(tempProcessoId);
    }

    try {
      const totalPages = await countPdfPages(file);

      const { filePath, fileUrl } = await this.uploadFileToStorage(file);

      await supabase
        .from('processos')
        .update({
          file_path: filePath,
          file_url: fileUrl,
          status: 'created',
          transcricao: { totalPages },
          total_pages: totalPages
        })
        .eq('id', tempProcessoId);

      await this.startAnalysis(tempProcessoId);

      return tempProcessoId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro no upload';

      await supabase
        .from('processos')
        .update({
          status: 'error',
          last_error_type: errorMessage
        })
        .eq('id', tempProcessoId);

      throw error;
    }
  }

  static async startAnalysis(processoId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;


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


    // Start processing in background (don't await to not block the UI)
    this.processPromptsSequentially(processoId).catch(error => {
    });
  }

  public static async processPromptsSequentially(processoId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;


    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Usuário não autenticado');
    }


    let promptCount = 0;

    while (true) {
      try {
        promptCount++;

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshedSession) {
            break;
          }
        }

        const validSession = currentSession || (await supabase.auth.getSession()).data.session;
        if (!validSession) {
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


        if (!response.ok) {
          const errorData = await response.json();
          break;
        }

        const result = await response.json();

        if (result.completed) {
          break;
        }

      } catch (error) {
        break;
      }
    }

  }

  static countPdfPages = countPdfPages;

  static async getAllProcessos(viewAll: boolean = false): Promise<Processo[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { data: userProfile } = await executeWithRetry(() =>
      supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
    );

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
        user_profile:user_profiles(first_name, last_name, email)
      `);

    if (!isAdmin || !viewAll) {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await executeWithRetry(() =>
      query.order('created_at', { ascending: false })
    );

    if (error) {
      throw new Error(`Não foi possível carregar os processos: ${error.message}`);
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
      .maybeSingle();

    if (error) {
      return null;
    }

    return data;
  }

  static async deleteProcesso(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const processo = await this.getProcessoById(id);
      if (!processo) {
        return { success: false, error: 'Processo não encontrado' };
      }

      const filesToDelete: string[] = [];

      if (processo.file_path) {
        filesToDelete.push(processo.file_path);
      }

      if (processo.original_file_path) {
        filesToDelete.push(processo.original_file_path);
      }

      if (processo.is_chunked) {
        const { data: chunks } = await supabase
          .from('process_chunks')
          .select('file_path')
          .eq('processo_id', id);

        if (chunks && chunks.length > 0) {
          filesToDelete.push(...chunks.map(c => c.file_path).filter(Boolean));
        }
      }

      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('processos')
          .remove(filesToDelete);

        if (storageError) {
        } else {
        }
      }

      const { error } = await supabase
        .from('processos')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: 'Não foi possível deletar o processo' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro inesperado ao deletar o processo' };
    }
  }

  static async updateProcessoName(id: string, newName: string): Promise<void> {
    const { error } = await supabase
      .from('processos')
      .update({ file_name: newName })
      .eq('id', id);

    if (error) {
      throw new Error('Não foi possível atualizar o nome do processo');
    }

  }

  static async getPaginasText(processoId: string): Promise<Pagina[]> {
    const { data, error } = await supabase
      .from('paginas')
      .select('*')
      .eq('processo_id', processoId)
      .order('page_number', { ascending: true });

    if (error) {
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


        const chunkDoc = await PDFDocument.create();
        for (let pageNum = startPage; pageNum < endPage; pageNum++) {
          const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
          chunkDoc.addPage(copiedPage);
        }

        const chunkBytes = await chunkDoc.save();
        const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });
        const chunkFileName = `chunk_${chunkIndex + 1}_of_${totalChunks}.pdf`;
        const chunkFile = new File([chunkBlob], chunkFileName, { type: 'application/pdf' });

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

      }

      await supabase
        .from('processos')
        .update({
          status: 'created',
          transcricao: { totalPages, totalChunks }
        })
        .eq('id', processoId);


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
    onProcessoCreated?: (processoId: string) => void,
    onProgress?: (uploaded: number, total: number) => void
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    const { getChunkConfiguration } = await import('../utils/pdfSplitter');

    const config = getChunkConfiguration(totalPages, file.size);

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
        total_chunks_count: config.totalChunks,
        current_processing_chunk: 0,
        total_pages: totalPages,
        chunks_uploaded_count: 0,
        upload_interrupted: false,
        transcricao: { totalPages, totalChunks: config.totalChunks, chunkSize: config.chunkSize }
      })
      .select()
      .single();

    if (processoError) {
      throw new Error('Não foi possível criar o processo');
    }

    if (onProcessoCreated) {
      onProcessoCreated(processoId);
    }


    const uploadChunksInBackground = async () => {
      try {
        const sanitizedFileName = this.sanitizeFileName(file.name);
        const originalPath = `${user.id}/${Date.now()}-original-${sanitizedFileName}`;

        const { error: originalUploadError } = await supabase.storage
          .from('processos')
          .upload(originalPath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (originalUploadError) {
          throw new Error(`Falha ao salvar arquivo original: ${originalUploadError.message}`);
        }

        await supabase
          .from('processos')
          .update({ original_file_path: originalPath })
          .eq('id', processoId);


        const { splitPDFIntoChunksWithOverlap } = await import('../utils/pdfSplitter');

        const chunks = await splitPDFIntoChunksWithOverlap(file);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
    
          if (onProgress) {
            onProgress(i, chunks.length);
          }

          const sanitizedFileName = this.sanitizeFileName(file.name);
          const timestamp = Date.now();
          const chunkPath = `${user.id}/${timestamp}-${sanitizedFileName.replace('.pdf', '')}_chunk${i + 1}.pdf`;

          const MAX_RETRIES = 30;
          let uploadData = null;
          let uploadError = null;
          let retryCount = 0;

          while (retryCount < MAX_RETRIES) {
            const result = await supabase.storage
              .from('processos')
              .upload(chunkPath, chunk.file, {
                cacheControl: '3600',
                upsert: true
              });

            uploadData = result.data;
            uploadError = result.error;

            if (!uploadError) {
              if (retryCount > 0) {
                  }
              break;
            }

            retryCount++;

            if (retryCount < MAX_RETRIES) {
              const backoffSeconds = Math.min(Math.pow(2, retryCount), 300);

              await supabase
                .from('processos')
                .update({
                  chunk_retry_count: retryCount,
                  current_failed_chunk: i,
                  last_chunk_error: `Tentativa ${retryCount}/${MAX_RETRIES}: ${uploadError.message}`,
                  upload_interrupted: true
                })
                .eq('id', processoId);

              await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));
            }
          }

          if (uploadError) {
                await supabase
              .from('processos')
              .update({
                status: 'error',
                upload_interrupted: true,
                last_chunk_error: `Falha após ${MAX_RETRIES} tentativas: ${uploadError.message}`
              })
              .eq('id', processoId);
            throw new Error(`Erro no upload da parte ${i + 1}: ${uploadError.message}`);
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
                await supabase
              .from('processos')
              .update({ upload_interrupted: true })
              .eq('id', processoId);
            throw new Error(`Erro ao salvar parte ${i + 1}: ${chunkError.message}`);
          }

          await supabase
            .from('processos')
            .update({
              chunks_uploaded_count: i + 1,
              last_chunk_uploaded_at: new Date().toISOString(),
              chunk_retry_count: 0,
              current_failed_chunk: null,
              last_chunk_error: null,
              upload_interrupted: false
            })
            .eq('id', processoId);

            }

        if (onProgress) {
          onProgress(chunks.length, chunks.length);
        }

        await supabase
          .from('processos')
          .update({
            status: 'created',
            transcricao: { totalPages, totalChunks: chunks.length, chunkSize: config.chunkSize },
            total_pages: totalPages,
            upload_interrupted: false
          })
          .eq('id', processoId);


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


      } catch (error) {
        await supabase
          .from('processos')
          .update({
            status: 'error',
            upload_interrupted: true
          })
          .eq('id', processoId);
        throw error;
      }
    };

    uploadChunksInBackground().catch(error => {
    });

    return processoId;
  }

  static async checkForInterruptedUploads(): Promise<Array<{ id: string; file_name: string; uploaded: number; total: number }>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: interrupted } = await supabase
      .from('processos')
      .select('id, file_name, chunks_uploaded_count, total_chunks_count')
      .eq('user_id', user.id)
      .eq('status', 'uploading')
      .eq('upload_interrupted', true)
      .order('created_at', { ascending: false })
      .limit(5);

    return interrupted?.map(p => ({
      id: p.id,
      file_name: p.file_name,
      uploaded: p.chunks_uploaded_count || 0,
      total: p.total_chunks_count || 0
    })) || [];
  }
}
