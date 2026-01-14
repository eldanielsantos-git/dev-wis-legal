import { DeadlineCategory, DeadlinePartyType } from '../types/analysis';

export interface ExtractedDeadline {
  subject: string;
  deadline_date: string;
  category?: DeadlineCategory;
  party_type: DeadlinePartyType;
  confidence: number;
}

const MONTH_NAMES: Record<string, number> = {
  'janeiro': 1, 'jan': 1,
  'fevereiro': 2, 'fev': 2,
  'março': 3, 'mar': 3,
  'abril': 4, 'abr': 4,
  'maio': 5, 'mai': 5,
  'junho': 6, 'jun': 6,
  'julho': 7, 'jul': 7,
  'agosto': 8, 'ago': 8,
  'setembro': 9, 'set': 9,
  'outubro': 10, 'out': 10,
  'novembro': 11, 'nov': 11,
  'dezembro': 12, 'dez': 12
};

const CATEGORY_KEYWORDS: Record<string, DeadlineCategory> = {
  'audiência': 'Audiência',
  'recurso': 'Recurso',
  'contestação': 'Contestação',
  'petição': 'Petição',
  'réplica': 'Réplica',
  'defesa': 'Prazo de Defesa',
  'apelação': 'Prazo de Apelação',
  'manifestação': 'Prazo de Manifestação',
  'impugnação': 'Contestação',
  'resposta': 'Prazo de Manifestação'
};

const PARTY_KEYWORDS = {
  author: ['autor', 'autora', 'querelante', 'requerente'],
  defendant: ['réu', 'ré', 'requerido', 'requerida', 'acusado', 'denunciado'],
  third_party: ['terceiro', 'assistente', 'litisconsorte', 'interveniente'],
  both: ['ambas as partes', 'todas as partes']
};

class DeadlineExtractor {
  extractFromText(text: string): ExtractedDeadline[] {
    const deadlines: ExtractedDeadline[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const extracted = this.extractFromLine(line);
      if (extracted) {
        deadlines.push(extracted);
      }
    }

    return deadlines;
  }

  private extractFromLine(line: string): ExtractedDeadline | null {
    const normalizedLine = line.toLowerCase().trim();

    if (!this.hasPrazoKeyword(normalizedLine)) {
      return null;
    }

    const date = this.extractDate(normalizedLine);
    if (!date) {
      return null;
    }

    const category = this.detectCategory(normalizedLine);
    const partyType = this.detectPartyType(normalizedLine);
    const subject = this.extractSubject(line, category);

    return {
      subject,
      deadline_date: date,
      category,
      party_type: partyType,
      confidence: this.calculateConfidence(normalizedLine, !!category)
    };
  }

  private hasPrazoKeyword(text: string): boolean {
    const keywords = [
      'prazo',
      'até',
      'vencimento',
      'data limite',
      'deadline',
      'audiência em',
      'audiência marcada',
      'sessão em'
    ];
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractDate(text: string): string | null {
    const datePatterns = [
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
      /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+de\s+(\d{4})/i,
      /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeDate(match);
      }
    }

    return null;
  }

  private normalizeDate(match: RegExpMatchArray): string | null {
    try {
      if (match[0].includes('de')) {
        const day = parseInt(match[1]);
        const monthName = match[2].toLowerCase();
        const year = parseInt(match[3]);
        const month = MONTH_NAMES[monthName];

        if (!month) return null;

        const date = new Date(year, month - 1, day);
        return date.toISOString().split('T')[0];
      }

      if (match[3]?.length === 4) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        const date = new Date(year, month - 1, day);
        return date.toISOString().split('T')[0];
      }

      if (match[1]?.length === 4) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        const date = new Date(year, month - 1, day);
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  private detectCategory(text: string): DeadlineCategory | undefined {
    for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
      if (text.includes(keyword)) {
        return category;
      }
    }
    return undefined;
  }

  private detectPartyType(text: string): DeadlinePartyType {
    for (const keyword of PARTY_KEYWORDS.both) {
      if (text.includes(keyword)) {
        return 'both';
      }
    }

    for (const keyword of PARTY_KEYWORDS.author) {
      if (text.includes(keyword)) {
        return 'author';
      }
    }

    for (const keyword of PARTY_KEYWORDS.defendant) {
      if (text.includes(keyword)) {
        return 'defendant';
      }
    }

    for (const keyword of PARTY_KEYWORDS.third_party) {
      if (text.includes(keyword)) {
        return 'third_party';
      }
    }

    return 'both';
  }

  private extractSubject(line: string, category?: DeadlineCategory): string {
    const cleanLine = line
      .replace(/^\s*[-•*]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim();

    if (cleanLine.length > 100) {
      return cleanLine.substring(0, 97) + '...';
    }

    if (cleanLine.length < 10 && category) {
      return category;
    }

    return cleanLine || 'Prazo extraído da análise';
  }

  private calculateConfidence(text: string, hasCategory: boolean): number {
    let confidence = 0.5;

    if (hasCategory) confidence += 0.2;
    if (text.includes('prazo')) confidence += 0.1;
    if (text.includes('audiência')) confidence += 0.15;
    if (text.includes('dias')) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  extractFromAnalysisResult(analysisContent: string): ExtractedDeadline[] {
    const allDeadlines: ExtractedDeadline[] = [];

    try {
      const parsed = JSON.parse(analysisContent);

      if (parsed.secoes) {
        for (const secao of parsed.secoes) {
          if (secao.campos) {
            for (const campo of secao.campos) {
              if (typeof campo.valor === 'string') {
                const deadlines = this.extractFromText(campo.valor);
                allDeadlines.push(...deadlines);
              } else if (Array.isArray(campo.valor)) {
                for (const item of campo.valor) {
                  if (typeof item === 'string') {
                    const deadlines = this.extractFromText(item);
                    allDeadlines.push(...deadlines);
                  } else if (typeof item === 'object' && item !== null) {
                    const itemText = JSON.stringify(item);
                    const deadlines = this.extractFromText(itemText);
                    allDeadlines.push(...deadlines);
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      const textDeadlines = this.extractFromText(analysisContent);
      allDeadlines.push(...textDeadlines);
    }

    return this.deduplicateDeadlines(allDeadlines);
  }

  private deduplicateDeadlines(deadlines: ExtractedDeadline[]): ExtractedDeadline[] {
    const seen = new Set<string>();
    const unique: ExtractedDeadline[] = [];

    for (const deadline of deadlines) {
      const key = `${deadline.deadline_date}-${deadline.subject.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(deadline);
      }
    }

    return unique.sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
  }
}

export const deadlineExtractor = new DeadlineExtractor();
