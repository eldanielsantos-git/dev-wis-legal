import { supabase } from '../lib/supabase';

export interface IntegrityIssue {
  processoId: string;
  fileName: string;
  issueType: 'missing_consolidation' | 'inconsistent_pages' | 'missing_pages';
  description: string;
  paginasCount: number;
  processContentCount: number;
  status: string;
}

export class IntegrityValidationService {
  static async checkProcessoIntegrity(processoId: string): Promise<IntegrityIssue | null> {
    const { data, error } = await supabase.rpc('check_processo_integrity', {
      p_processo_id: processoId
    });

    if (error) {
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }

  static async checkAllProcessosIntegrity(): Promise<IntegrityIssue[]> {
    const query = `
      SELECT
        p.id as "processoId",
        p.file_name as "fileName",
        p.status,
        (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id) as "paginasCount",
        COALESCE(jsonb_array_length(p.process_content), 0) as "processContentCount",
        CASE
          WHEN p.status IN ('completed', 'error')
            AND (p.process_content IS NULL OR jsonb_array_length(p.process_content) = 0)
            AND (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id) > 0
          THEN 'missing_consolidation'
          WHEN p.status = 'completed'
            AND jsonb_array_length(p.process_content) != (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id)
          THEN 'inconsistent_pages'
          WHEN p.status = 'completed'
            AND (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id) = 0
          THEN 'missing_pages'
          ELSE NULL
        END as "issueType"
      FROM processos p
      WHERE p.status IN ('completed', 'error')
      HAVING
        CASE
          WHEN p.status IN ('completed', 'error')
            AND (p.process_content IS NULL OR jsonb_array_length(p.process_content) = 0)
            AND (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id) > 0
          THEN 'missing_consolidation'
          WHEN p.status = 'completed'
            AND jsonb_array_length(p.process_content) != (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id)
          THEN 'inconsistent_pages'
          WHEN p.status = 'completed'
            AND (SELECT COUNT(*) FROM paginas WHERE processo_id = p.id) = 0
          THEN 'missing_pages'
          ELSE NULL
        END IS NOT NULL
      ORDER BY p.created_at DESC;
    `;

    const { data, error } = await supabase.rpc('execute_raw_sql', { sql_query: query });

    if (error) {
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      description: this.getIssueDescription(row.issueType, row.paginasCount, row.processContentCount)
    }));
  }

  private static getIssueDescription(issueType: string, paginasCount: number, processContentCount: number): string {
    switch (issueType) {
      case 'missing_consolidation':
        return `${paginasCount} páginas transcritas não consolidadas. O processo precisa ser consolidado.`;
      case 'inconsistent_pages':
        return `Inconsistência: ${paginasCount} páginas na tabela vs ${processContentCount} no JSON consolidado.`;
      case 'missing_pages':
        return `Processo marcado como completo mas sem páginas transcritas.`;
      default:
        return 'Problema desconhecido detectado.';
    }
  }

  static async autoHealProcesso(processoId: string): Promise<{ success: boolean; message: string }> {
    try {
      const issue = await this.checkProcessoIntegrity(processoId);

      if (!issue) {
        return { success: true, message: 'Processo já está íntegro.' };
      }

      // REMOVED: Consolidation is now automatic in finalize-transcription
      // If missing_consolidation still occurs, it means finalize-transcription wasn't called
      if (issue.issueType === 'missing_consolidation') {
        return {
          success: false,
          message: 'O processo precisa ser finalizado novamente. A consolidação agora é automática.'
        };
      }

      return {
        success: false,
        message: `Tipo de problema '${issue.issueType}' não pode ser resolvido automaticamente.`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Erro durante auto-recuperação: ${error.message}`
      };
    }
  }
}
