# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planejado
- Suporte a arquivos DOCX
- Análise em múltiplos idiomas
- API pública para integrações
- Dashboard de analytics avançado

---

## [1.2.0] - 2025-12-17

### Added
- Sistema de notificações de limite de tokens
- Monitoramento automático de uso de tokens
- Alertas diários para usuários próximos do limite
- Trigger automático para notificações
- Admin page para gerenciamento de notificações

### Changed
- Melhorias na performance do sistema de análise
- Otimização de queries no banco de dados
- Atualização de dependências

### Fixed
- Correção no cálculo de tokens restantes
- Fix em edge case de consolidação de análise
- Correção de race condition em chat

---

## [1.1.0] - 2025-12-10

### Added
- Sistema de tags para processos
- Filtros avançados por tags
- Color picker para tags customizadas
- Admin panel para gerenciamento de tags
- Busca inteligente no conteúdo dos processos

### Changed
- Redesign da página de processos
- Melhoria na UX de compartilhamento
- Otimização do loading de análises

### Fixed
- Fix na paginação de processos
- Correção em RLS policies de compartilhamento
- Fix em edge case de upload de PDF grande

---

## [1.0.0] - 2025-12-01

### Added
- Sistema completo de análise de processos jurídicos
- Upload de PDFs até 5000 páginas
- 10 tipos de análise estruturada
- Sistema de chat interativo sobre processos
- Processamento em chunks para arquivos grandes
- Integração com Google Gemini Pro 1.5
- Sistema de tokens e créditos
- Assinaturas via Stripe (Free, Pro, Enterprise)
- Pacotes avulsos de tokens
- Sistema de compartilhamento de processos
- Permissões read-only e full access
- Dashboard administrativo completo
- Monitoramento e recovery automático
- Health checks e alertas
- Email notifications
- Sistema de conquistas (achievements)
- Dark mode
- Responsivo para mobile

### Security
- Row Level Security (RLS) em todas as tabelas
- Autenticação via Supabase Auth
- Validação de tokens server-side
- Proteção contra race conditions
- Sanitização de inputs

### Performance
- Processamento paralelo de chunks
- Context caching do Gemini
- Otimização de queries
- Lazy loading de componentes
- Image optimization

---

## [0.9.0] - 2025-11-20 (Beta)

### Added
- Beta do sistema de análise
- Interface básica de upload
- Análise simples com Gemini
- Sistema básico de tokens
- Autenticação com Supabase

### Known Issues
- Performance issues com PDFs grandes
- Consolidação de resultados instável
- UI não otimizada para mobile

---

## [0.5.0] - 2025-11-01 (Alpha)

### Added
- Prototipo inicial
- Upload básico de PDF
- Extração de texto
- Primeira integração com IA
- Interface básica React

### Notes
- Versão de prova de conceito
- Não recomendado para produção

---

## Categorias de Mudanças

### Added
Novas features adicionadas.

### Changed
Mudanças em features existentes.

### Deprecated
Features que serão removidas em versões futuras.

### Removed
Features removidas.

### Fixed
Bug fixes.

### Security
Mudanças relacionadas a segurança.

### Performance
Melhorias de performance.

---

## Notas de Migration

### 1.2.0 → Latest
```sql
-- Executar migration de notificações de tokens
-- Ver: supabase/migrations/20251217130703_add_token_limit_notifications.sql
-- Ver: supabase/migrations/20251217130807_add_token_usage_monitoring_trigger.sql
```

### 1.1.0 → 1.2.0
```sql
-- Executar migrations de tags
-- Ver migrations em supabase/migrations/
```

### 1.0.0 → 1.1.0
```sql
-- Executar todas as migrations desde 1.0.0
-- Não há breaking changes
```

---

## Breaking Changes

### 1.0.0
Primeira versão estável. Não há breaking changes anteriores.

---

## Contribuindo

Veja [CONTRIBUTING.md](../11-contributing/CONTRIBUTING.md) para detalhes sobre como contribuir.

---

**Legenda:**
- `[Unreleased]` - Mudanças ainda não lançadas
- `[X.Y.Z]` - Versão lançada
- `YYYY-MM-DD` - Data do release

---

[Unreleased]: https://github.com/repo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/repo/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/repo/releases/tag/v1.0.0
