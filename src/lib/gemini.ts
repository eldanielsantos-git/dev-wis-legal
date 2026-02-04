import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AnalysisPrompt {
  id: string;
  title: string;
  prompt_content: string;
  execution_order: number;
}

export interface AnalysisResult {
  promptId: string;
  promptTitle: string;
  executionOrder: number;
  content: string;
  tokensUsed?: number;
  executionTimeMs: number;
}

export interface FileUploadResult {
  fileUri: string;
  fileName: string;
  mimeType: string;
  state: string;
  uploadedAt: Date;
  expiresAt: Date;
}

export interface FileMetadata {
  uri: string;
  name: string;
  mimeType: string;
  state: string;
  sizeBytes?: string;
  createTime?: string;
  updateTime?: string;
  expirationTime?: string;
}

const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 60000;
const FILE_PROCESSING_TIMEOUT = 5 * 60 * 1000;
const POLLING_INTERVAL = 2000;

export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private fileManager: any | null = null;
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxOutputTokens: number;

  constructor(config?: Partial<GeminiConfig>) {
    this.apiKey = config?.apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }

    this.model = config?.model || DEFAULT_MODEL;
    this.temperature = config?.temperature ?? DEFAULT_TEMPERATURE;
    this.maxOutputTokens = config?.maxOutputTokens ?? DEFAULT_MAX_TOKENS;
  }

  async uploadFileToGemini(file: File, displayName?: string): Promise<FileUploadResult> {
    if (!this.fileManager) {
      throw new Error('Gemini File Manager não configurado. Verifique a API key.');
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const uploadResult = await this.fileManager.uploadFile(file, {
          mimeType: file.type || 'application/pdf',
          displayName: displayName || file.name,
        });

        const uploadedAt = new Date();
        const expiresAt = new Date(uploadedAt.getTime() + 48 * 60 * 60 * 1000);

        return {
          fileUri: uploadResult.file.uri,
          fileName: uploadResult.file.name,
          mimeType: uploadResult.file.mimeType,
          state: uploadResult.file.state,
          uploadedAt,
          expiresAt,
        };
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw new Error(`Falha ao fazer upload após ${maxRetries} tentativas: ${lastError?.message}`);
  }

  async waitForFileProcessing(fileName: string): Promise<FileMetadata> {
    if (!this.fileManager) {
      throw new Error('Gemini File Manager não configurado.');
    }

    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < FILE_PROCESSING_TIMEOUT) {
      attempts++;

      try {
        const fileMetadata = await this.fileManager.getFile(fileName);

        if (fileMetadata.state === 'ACTIVE') {
          return {
            uri: fileMetadata.uri,
            name: fileMetadata.name,
            mimeType: fileMetadata.mimeType,
            state: fileMetadata.state,
            sizeBytes: fileMetadata.sizeBytes,
            createTime: fileMetadata.createTime,
            updateTime: fileMetadata.updateTime,
            expirationTime: fileMetadata.expirationTime,
          };
        }

        if (fileMetadata.state === 'FAILED') {
          throw new Error('Processamento do arquivo falhou no Gemini');
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      } catch (error: any) {
        if (error.message.includes('not found')) {
          throw new Error(`Arquivo não encontrado: ${fileName}`);
        }
        throw error;
      }
    }

    throw new Error(`Timeout: arquivo não ficou pronto em ${FILE_PROCESSING_TIMEOUT / 1000}s`);
  }

  async getFileMetadata(fileName: string): Promise<FileMetadata | null> {
    if (!this.fileManager) {
      throw new Error('Gemini File Manager não configurado.');
    }

    try {
      const fileMetadata = await this.fileManager.getFile(fileName);
      return {
        uri: fileMetadata.uri,
        name: fileMetadata.name,
        mimeType: fileMetadata.mimeType,
        state: fileMetadata.state,
        sizeBytes: fileMetadata.sizeBytes,
        createTime: fileMetadata.createTime,
        updateTime: fileMetadata.updateTime,
        expirationTime: fileMetadata.expirationTime,
      };
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  async deleteGeminiFile(fileName: string): Promise<boolean> {
    if (!this.fileManager) {
      throw new Error('Gemini File Manager não configurado.');
    }

    try {
      await this.fileManager.deleteFile(fileName);
      return true;
    } catch (error: any) {
      return false;
    }
  }

  async analyzeWithFileUri(
    fileUri: string,
    mimeType: string,
    promptText: string
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API não configurada. Verifique a API key.');
    }

    const startTime = Date.now();

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      const result = await model.generateContent([
        {
          fileData: {
            mimeType,
            fileUri,
          },
        },
        {
          text: promptText,
        },
      ]);

      const response = await result.response;
      const text = response.text();

      return text;
    } catch (error: any) {
      throw new Error(
        `Falha na análise com Gemini: ${error?.message || 'Erro desconhecido'}`
      );
    }
  }

  async convertPDFToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo PDF'));
      };

      reader.readAsDataURL(file);
    });
  }

  async analyzePDFWithPrompt(
    pdfBase64: string,
    mimeType: string,
    promptText: string
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini API não configurada. Verifique a API key.');
    }

    const startTime = Date.now();

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: pdfBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxOutputTokens,
        },
      });

      const response = await result.response;
      const text = response.text();

      return text;
    } catch (error: any) {
      throw new Error(
        `Falha na análise com Gemini: ${error?.message || 'Erro desconhecido'}`
      );
    }
  }

  async analyzeSequentially(
    pdfBase64: string,
    mimeType: string,
    prompts: AnalysisPrompt[],
    onProgress?: (current: number, total: number, promptTitle: string) => void
  ): Promise<AnalysisResult[]> {
    if (!this.genAI) {
      throw new Error('Gemini API não configurada. Verifique a API key.');
    }

    const results: AnalysisResult[] = [];
    const sortedPrompts = [...prompts].sort((a, b) => a.execution_order - b.execution_order);

    for (let i = 0; i < sortedPrompts.length; i++) {
      const prompt = sortedPrompts[i];

      if (onProgress) {
        onProgress(i + 1, sortedPrompts.length, prompt.title);
      }

      const startTime = Date.now();

      try {
        const content = await this.analyzePDFWithPrompt(
          pdfBase64,
          mimeType,
          prompt.prompt_content
        );

        const executionTime = Date.now() - startTime;

        results.push({
          promptId: prompt.id,
          promptTitle: prompt.title,
          executionOrder: prompt.execution_order,
          content,
          executionTimeMs: executionTime,
        });
      } catch (error: any) {
        throw error;
      }
    }

    return results;
  }

  formatResponse(responseText: string): string {
    try {
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const jsonData = JSON.parse(cleanedText);
      return this.convertJSONToMarkdown(jsonData);
    } catch {
      return responseText;
    }
  }

  private convertJSONToMarkdown(obj: any, level: number = 0): string {
    const lines: string[] = [];
    const indent = '  '.repeat(level);

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach((item) => {
          if (typeof item === 'object') {
            lines.push(this.convertJSONToMarkdown(item, level));
          } else {
            lines.push(`${indent}- ${item}`);
          }
        });
      } else {
        for (const [key, value] of Object.entries(obj)) {
          const isSectionTitle = /^\d+\./.test(key);
          const isSubsectionTitle = /^\d+\.\d+/.test(key);

          if (isSectionTitle) {
            if (isSubsectionTitle) {
              lines.push(`\n#### ${key}`);
            } else {
              lines.push(`\n### ${key}`);
            }
          } else {
            lines.push(`\n**${key}:**`);
          }

          if (typeof value === 'object' && value !== null) {
            lines.push(this.convertJSONToMarkdown(value, level + 1));
          } else if (value !== null && value !== undefined) {
            lines.push(`${value}`);
          }
        }
      }
    } else {
      lines.push(`${indent}${obj}`);
    }

    return lines.join('\n');
  }

  isConfigured(): boolean {
    return this.genAI !== null;
  }

  getModelName(): string {
    return this.model;
  }

  hasFileManagerConfigured(): boolean {
    return false;
  }
}

export const geminiService = new GeminiService();
