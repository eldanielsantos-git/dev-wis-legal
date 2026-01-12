import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 [Supabase Config] Verificando variáveis de ambiente...');
console.log('🔍 [Supabase Config] MODE:', import.meta.env.MODE);
console.log('🔍 [Supabase Config] DEV:', import.meta.env.DEV);
console.log('🔍 [Supabase Config] VITE_SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ NÃO DEFINIDA');
console.log('🔍 [Supabase Config] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Definida' : '❌ NÃO DEFINIDA');
console.log('🔍 [Supabase Config] Todas as variáveis env:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));

if (!supabaseUrl || !supabaseAnonKey) {
  // Show user-friendly error
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #0F0E0D;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  errorDiv.innerHTML = `
    <div style="text-align: center; max-width: 600px; padding: 40px;">
      <h1 style="font-size: 32px; margin-bottom: 20px;">⚠️ Erro de Configuração</h1>
      <p style="font-size: 18px; margin-bottom: 20px; color: #ccc;">
        As variáveis de ambiente não foram carregadas durante o build.
      </p>
      <div style="background: #1a1918; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
        <p style="margin: 0 0 10px 0; color: #888; font-size: 14px;">Variáveis faltando:</p>
        <ul style="margin: 0; padding-left: 20px; color: #ff6b6b;">
          ${!supabaseUrl ? '<li>VITE_SUPABASE_URL</li>' : ''}
          ${!supabaseAnonKey ? '<li>VITE_SUPABASE_ANON_KEY</li>' : ''}
        </ul>
      </div>
      <div style="background: #2a2928; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Solução:</p>
        <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #ccc;">
          <li>As variáveis já estão configuradas no Netlify ✅</li>
          <li>Você precisa fazer um <strong>novo deploy</strong></li>
          <li>Vá em <strong>Deploys → Trigger deploy → Clear cache and deploy site</strong></li>
          <li>Aguarde o build completar (2-3 minutos)</li>
          <li>Recarregue esta página</li>
        </ol>
      </div>
      <button
        onclick="window.location.href='https://app.netlify.com'"
        style="
          background: white;
          color: #0F0E0D;
          border: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-right: 10px;
        "
      >
        Ir para Netlify Dashboard
      </button>
      <button
        onclick="window.location.reload()"
        style="
          background: #2a2928;
          color: white;
          border: 1px solid #444;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        "
      >
        Recarregar Página
      </button>
      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        Ambiente: ${import.meta.env.MODE} | Build: ${import.meta.env.DEV ? 'dev' : 'production'}
      </p>
    </div>
  `;
  document.body.appendChild(errorDiv);

  throw new Error('Missing Supabase URL or Anon Key - Deploy required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ProcessoStatus = 'created' | 'analyzing' | 'completed' | 'error';

export type AnalysisResultStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Pagina {
  id: string;
  processo_id: string;
  page_number: number;
  text: string;
  created_at: string;
}

export interface ProcessContent {
  pagina: number;
  content: string;
}

export interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export interface AnalysisPrompt {
  id: string;
  title: string;
  prompt_content: string;
  execution_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FailedModel {
  model_id: string;
  model_name: string;
  error: string;
  error_code?: string;
  timestamp: string;
}

export interface AnalysisResult {
  id: string;
  processo_id: string;
  prompt_id: string;
  prompt_title: string;
  result_content: string | null;
  execution_order: number;
  status: AnalysisResultStatus;
  error_message: string | null;
  tokens_used: number | null;
  execution_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
  current_model_id: string | null;
  current_model_name: string | null;
  attempt_count: number;
  failed_models: FailedModel[];
  model_switched_at: string | null;
}

export interface Processo {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  transcricao: {
    totalPages: number;
  };
  paginas?: Pagina[];
  process_content?: ProcessContent[];
  status: ProcessoStatus;
  analysis_started_at?: string;
  analysis_completed_at?: string;
  current_prompt_number?: number;
  total_prompts?: number;
  created_at: string;
  updated_at: string;
  last_error_type?: string;
  user_profile?: UserProfile;
  analysis_results?: AnalysisResult[];
  current_llm_model_id?: string | null;
  current_llm_model_name?: string | null;
  llm_model_switching?: boolean;
  llm_switch_reason?: string | null;
  llm_models_attempted?: Array<{
    model_id: string;
    model_name: string;
    result: 'failed' | 'success';
    timestamp: string;
  }>;
  gemini_file_uri?: string | null;
  gemini_file_name?: string | null;
  gemini_file_mime_type?: string | null;
  gemini_file_state?: 'PROCESSING' | 'ACTIVE' | 'FAILED' | null;
  gemini_file_uploaded_at?: string | null;
  gemini_file_expires_at?: string | null;
  use_file_api?: boolean;
  tags?: ProcessoTag[];
}

export interface AdminSystemModel {
  id: string;
  project_id: string;
  location: string;
  model_id: string;
  name: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  llm_provider?: string;
  display_name?: string;
  system_model?: string;
  temperature?: number | null;
  max_tokens?: number | null;
}

export interface AnalysisExecution {
  id: string;
  processo_id: string;
  analysis_result_id: string;
  model_id: string;
  model_name: string;
  attempt_number: number;
  status: 'success' | 'failed' | 'timeout' | 'api_error' | 'rate_limit' | 'quota_exceeded';
  error_message: string | null;
  error_code: string | null;
  execution_time_ms: number | null;
  tokens_used: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface ProcessoTag {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessoTagAssignment {
  id: string;
  processo_id: string;
  tag_id: string;
  assigned_by: string | null;
  assigned_at: string;
  tag?: ProcessoTag;
}

export interface CreateTagInput {
  name: string;
  slug?: string;
  color: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
  color?: string;
  description?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface TagStatistics {
  tag_id: string;
  tag_name: string;
  tag_color: string;
  usage_count: number;
  last_used_at: string | null;
  most_recent_processo: string | null;
}

export interface TagColor {
  name: string;
  light: string;
  dark: string;
  category: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
}
