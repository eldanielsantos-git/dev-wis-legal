# Contributing

Guias para contribuir com o projeto.

## 📋 Documentos Nesta Seção

### [Guia de Contribuição](./CONTRIBUTING.md)
Guia completo de como contribuir.

**Tópicos:**
- Como contribuir
- Setup do ambiente
- Processo de desenvolvimento
- Pull Request process
- Padrões de commit

---

### [Code Review Process](./code-review.md)
Processo de revisão de código.

**Tópicos:**
- Checklist de code review
- Boas práticas
- O que revisar
- Como dar feedback

---

### [Style Guide](./style-guide.md)
Guia de estilo de código.

**Tópicos:**
- TypeScript conventions
- React best practices
- CSS/Tailwind guidelines
- Naming conventions
- File organization

---

## 🤝 Como Contribuir

1. **Fork** o repositório
2. **Clone** seu fork
3. **Crie um branch** para sua feature
4. **Faça suas alterações**
5. **Teste** suas alterações
6. **Commit** com mensagens claras
7. **Push** para seu fork
8. **Abra um Pull Request**

---

## 📝 Padrões de Commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: Nova feature
- `fix`: Bug fix
- `docs`: Documentação
- `style`: Formatação
- `refactor`: Refatoração
- `test`: Testes
- `chore`: Manutenção

### Exemplos
```
feat(analysis): add support for DOCX files
fix(auth): resolve token refresh issue
docs(api): update edge functions documentation
```

---

## 🔍 Code Review Checklist

### Funcionalidade
- [ ] Código funciona como esperado
- [ ] Testes passam
- [ ] Sem bugs óbvios

### Qualidade
- [ ] Código limpo e legível
- [ ] Bem documentado
- [ ] Sem código duplicado
- [ ] Sem hardcoded values

### Performance
- [ ] Sem problemas de performance
- [ ] Queries otimizadas
- [ ] Sem memory leaks

### Segurança
- [ ] Sem vulnerabilidades
- [ ] Validação de inputs
- [ ] RLS correto

---

## 🔗 Links Relacionados

- [Architecture](../02-architecture/README.md)
- [Style Guide](./style-guide.md)
- [Getting Started](../01-getting-started/README.md)

---

[← Voltar ao Índice Principal](../README.md)
