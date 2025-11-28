/*
  # Inserção dos 9 Prompts Iniciais de Análise

  ## Resumo

  Insere os 9 prompts padrão que serão executados sequencialmente
  pelo Gemini para análise completa de processos judiciais.

  ## Lista de Prompts

  1. Visão Geral do Processo
  2. Resumo Estratégico
  3. Comunicações e Prazos
  4. Admissibilidade Recursal
  5. Estratégias Jurídicas Recomendadas
  6. Riscos e Alertas Processuais
  7. Balanço Financeiro e Créditos Processuais
  8. Mapa de Preclusões Processuais
  9. Conclusões e Perspectivas Processuais
*/

-- Limpar prompts existentes (caso esteja re-executando)
TRUNCATE analysis_prompts CASCADE;

-- =====================================================
-- PROMPT 1: Visão Geral do Processo
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Visão Geral do Processo',
  'Você é um assistente jurídico especializado em análise de processos judiciais brasileiros.

Analise o documento PDF fornecido e extraia as seguintes informações em formato JSON estruturado:

{
  "numero_processo": "string (número CNJ do processo)",
  "partes": {
    "autores": ["array de nomes"],
    "reus": ["array de nomes"]
  },
  "vara": "string (vara/juízo)",
  "comarca": "string",
  "data_distribuicao": "string (DD/MM/AAAA)",
  "valor_causa": "string",
  "assunto_principal": "string",
  "tipo_acao": "string",
  "fase_processual": "string (conhecimento/execução/recursal)",
  "resumo_breve": "string (máximo 300 caracteres)"
}

IMPORTANTE: Cite as páginas onde encontrou cada informação usando o formato [pág. X]. Se alguma informação não estiver disponível, use null.',
  1,
  true
);

-- =====================================================
-- PROMPT 2: Resumo Estratégico
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Resumo Estratégico',
  'Você é um advogado estrategista experiente analisando um processo judicial.

Crie um resumo estratégico do processo em formato JSON:

{
  "narrativa_dos_fatos": "string (descrição cronológica dos fatos principais)",
  "pedidos_principais": ["array de pedidos do autor"],
  "argumentos_centrais_autor": ["array de argumentos"],
  "defesa_resumida": "string (resumo da defesa apresentada pelo réu)",
  "argumentos_centrais_reu": ["array de argumentos"],
  "decisoes_importantes": [
    {
      "tipo": "string (sentença/despacho/decisão)",
      "data": "string",
      "resumo": "string",
      "pagina": "integer"
    }
  ],
  "status_atual": "string (status processual atual)",
  "proximos_passos_previstos": ["array de próximos passos esperados"]
}

Cite as páginas relevantes. Use linguagem profissional mas acessível.',
  2,
  true
);

-- =====================================================
-- PROMPT 3: Comunicações e Prazos
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Comunicações e Prazos',
  'Você é um assistente focado em gestão de prazos processuais.

Identifique todas as comunicações e prazos no processo em formato JSON:

{
  "intimacoes": [
    {
      "data": "string",
      "destinatario": "string",
      "tipo": "string",
      "prazo_dias": "integer",
      "data_vencimento": "string",
      "status": "string (pendente/cumprido/vencido)",
      "pagina": "integer"
    }
  ],
  "citacoes": [
    {
      "data": "string",
      "citado": "string",
      "tipo": "string (AR/oficial/edital)",
      "pagina": "integer"
    }
  ],
  "publicacoes": [
    {
      "data": "string",
      "tipo": "string",
      "resumo": "string",
      "pagina": "integer"
    }
  ],
  "prazos_criticos": [
    {
      "descricao": "string",
      "data_limite": "string",
      "dias_restantes": "integer",
      "prioridade": "string (alta/média/baixa)"
    }
  ]
}

Seja preciso nas datas e cálculos de prazo.',
  3,
  true
);

-- =====================================================
-- PROMPT 4: Admissibilidade Recursal
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Admissibilidade Recursal',
  'Você é um especialista em recursos judiciais e admissibilidade.

Analise as possibilidades recursais do processo em formato JSON:

{
  "fase_atual_permite_recurso": "boolean",
  "recursos_cabiveis": [
    {
      "tipo": "string (apelação/agravo/embargos/etc)",
      "prazo": "string",
      "requisitos": ["array de requisitos"],
      "fundamentacao_legal": "string",
      "viabilidade": "string (alta/média/baixa)",
      "observacoes": "string"
    }
  ],
  "recursos_ja_interpostos": [
    {
      "tipo": "string",
      "data_interposicao": "string",
      "status": "string",
      "pagina": "integer"
    }
  ],
  "preclusoes_identificadas": [
    {
      "tipo": "string",
      "descricao": "string",
      "data_preclusao": "string",
      "pagina": "integer"
    }
  ],
  "recomendacao": "string (recomendação estratégica sobre recursos)"
}

Seja técnico e preciso na análise recursal.',
  4,
  true
);

-- =====================================================
-- PROMPT 5: Estratégias Jurídicas Recomendadas
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Estratégias Jurídicas Recomendadas',
  'Você é um advogado sênior propondo estratégias jurídicas.

Proponha estratégias baseadas na análise do processo em formato JSON:

{
  "teses_juridicas_aplicaveis": [
    {
      "tese": "string (descrição da tese)",
      "fundamentacao": "string (base legal e jurisprudencial)",
      "aplicabilidade": "string (alta/média/baixa)",
      "precedentes": ["array de precedentes relevantes"]
    }
  ],
  "argumentos_fortes_a_explorar": ["array de argumentos"],
  "vulnerabilidades_identificadas": ["array de pontos fracos"],
  "producao_de_provas": [
    {
      "tipo_prova": "string",
      "relevancia": "string",
      "momento_adequado": "string"
    }
  ],
  "acordos_e_negociacoes": {
    "viabilidade": "string (alta/média/baixa)",
    "sugestoes": ["array de sugestões"]
  },
  "timeline_estrategica": [
    {
      "acao": "string",
      "momento": "string",
      "prioridade": "string"
    }
  ]
}

Seja estratégico e prático nas recomendações.',
  5,
  true
);

-- =====================================================
-- PROMPT 6: Riscos e Alertas Processuais
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Riscos e Alertas Processuais',
  'Você é um especialista em gestão de riscos processuais.

Identifique todos os riscos e alertas no processo em formato JSON:

{
  "riscos_identificados": [
    {
      "tipo": "string",
      "descricao": "string",
      "nivel_risco": "string (crítico/alto/médio/baixo)",
      "probabilidade": "string (alta/média/baixa)",
      "impacto": "string (alto/médio/baixo)",
      "mitigacao": "string (ações para mitigar)",
      "pagina": "integer"
    }
  ],
  "alertas_urgentes": [
    {
      "descricao": "string",
      "prazo": "string",
      "acao_necessaria": "string",
      "consequencia_inacao": "string"
    }
  ],
  "pontos_criticos_atencao": ["array de pontos críticos"],
  "analise_probabilidade_sucesso": {
    "percentual_estimado": "string",
    "fatores_favoraveis": ["array"],
    "fatores_desfavoraveis": ["array"]
  }
}

Seja realista e objetivo na avaliação de riscos.',
  6,
  true
);

-- =====================================================
-- PROMPT 7: Balanço Financeiro e Créditos
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Balanço Financeiro e Créditos Processuais',
  'Você é um especialista em análise financeira processual.

Extraia e organize informações financeiras do processo em formato JSON:

{
  "valor_da_causa": "string",
  "valores_em_discussao": [
    {
      "descricao": "string",
      "valor": "string",
      "natureza": "string (principal/juros/multa/etc)",
      "pagina": "integer"
    }
  ],
  "custas_processuais": [
    {
      "tipo": "string",
      "valor": "string",
      "data": "string",
      "status": "string (pago/pendente)",
      "pagina": "integer"
    }
  ],
  "honorarios": [
    {
      "tipo": "string (sucumbenciais/contratuais)",
      "valor": "string",
      "beneficiario": "string",
      "pagina": "integer"
    }
  ],
  "garantias_e_caucoes": [
    {
      "tipo": "string",
      "valor": "string",
      "status": "string",
      "pagina": "integer"
    }
  ],
  "balanco_financeiro": {
    "total_creditos_possiveis": "string",
    "total_debitos_possiveis": "string",
    "resultado_liquido_estimado": "string"
  }
}

Seja preciso nos valores e cálculos.',
  7,
  true
);

-- =====================================================
-- PROMPT 8: Mapa de Preclusões Processuais
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Mapa de Preclusões Processuais',
  'Você é um especialista em direito processual e preclusões.

Identifique todas as preclusões ocorridas ou potenciais em formato JSON:

{
  "preclusoes_consumadas": [
    {
      "tipo": "string (temporal/lógica/consumativa)",
      "descricao": "string (o que precluiu)",
      "data_preclusao": "string",
      "consequencia": "string",
      "fundamentacao_legal": "string",
      "pagina": "integer"
    }
  ],
  "oportunidades_perdidas": [
    {
      "descricao": "string",
      "momento_adequado": "string",
      "porque_nao_foi_feito": "string",
      "impacto": "string"
    }
  ],
  "preclusoes_iminentes": [
    {
      "descricao": "string",
      "prazo_limite": "string",
      "acao_necessaria": "string",
      "prioridade": "string"
    }
  ],
  "direitos_ainda_exercitaveis": [
    {
      "direito": "string",
      "prazo": "string",
      "condicoes": "string"
    }
  ]
}

Seja técnico e preciso na identificação de preclusões.',
  8,
  true
);

-- =====================================================
-- PROMPT 9: Conclusões e Perspectivas
-- =====================================================

INSERT INTO analysis_prompts (title, prompt_content, execution_order, is_active) VALUES (
  'Conclusões e Perspectivas Processuais',
  'Você é um advogado sênior apresentando conclusões finais ao cliente.

Elabore uma análise conclusiva do processo em formato JSON:

{
  "sintese_do_caso": "string (resumo executivo em 2-3 parágrafos)",
  "posicao_atual_do_cliente": "string (favorável/neutra/desfavorável)",
  "principais_desafios": ["array de desafios principais"],
  "principais_oportunidades": ["array de oportunidades"],
  "projecoes": {
    "melhor_cenario": "string",
    "cenario_provavel": "string",
    "pior_cenario": "string"
  },
  "recomendacoes_prioritarias": [
    {
      "prioridade": "integer (1-5)",
      "acao": "string",
      "justificativa": "string",
      "prazo_sugerido": "string"
    }
  ],
  "necessidade_assessoria_especializada": {
    "necessaria": "boolean",
    "areas": ["array de áreas"],
    "justificativa": "string"
  },
  "timeline_futuro": [
    {
      "evento_previsto": "string",
      "prazo_estimado": "string",
      "preparacao_necessaria": "string"
    }
  ],
  "observacoes_finais": "string (observações importantes do advogado)"
}

Seja objetivo, realista e orientado a ação. Use linguagem profissional mas acessível ao cliente.',
  9,
  true
);

-- =====================================================
-- VALIDAÇÃO
-- =====================================================

-- Verificar que todos os 9 prompts foram inseridos
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM analysis_prompts WHERE is_active = true) != 9 THEN
    RAISE EXCEPTION 'Erro: Devem existir exatamente 9 prompts ativos';
  END IF;
END $$;
