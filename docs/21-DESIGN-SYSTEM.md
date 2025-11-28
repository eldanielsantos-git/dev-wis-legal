# 21 - Design System

## 📋 Visão Geral

O WisLegal utiliza um design system moderno e profissional baseado em Tailwind CSS, com foco em elegância jurídica, legibilidade e usabilidade.

## 🎨 Paleta de Cores

### Cores Primárias (Tema Escuro - Padrão)

```css
:root {
  /* Background Levels */
  --theme-bg-primary: #0F0E0D;     /* Fundo principal - preto suave */
  --theme-bg-secondary: #1A1918;    /* Cards e elevações */
  --theme-bg-tertiary: #252321;     /* Hover states */

  /* Text Colors */
  --theme-text-primary: #FAFAFA;    /* Texto principal - branco suave */
  --theme-text-secondary: #C6B08C;  /* Texto secundário - dourado */
  --theme-text-tertiary: #8A7F72;   /* Texto terciário - cinza quente */

  /* Accent Colors */
  --theme-accent: #C6B08C;          /* Dourado elegante */
  --theme-border: #3D3A37;          /* Bordas sutis */
  --theme-card: #C6B08C;            /* Destaque de cards */
}
```

### Cores Semânticas

```javascript
const colors = {
  // Status
  success: '#10B981',  // Verde
  warning: '#F59E0B',  // Amarelo/Laranja
  error: '#EF4444',    // Vermelho
  info: '#3B82F6',     // Azul

  // Process Status
  created: '#6B7280',      // Cinza
  uploading: '#3B82F6',    // Azul
  analyzing: '#F59E0B',    // Amarelo
  completed: '#10B981',    // Verde
  error: '#EF4444',        // Vermelho
};
```

### Cores do Tema Claro

```css
[data-theme="light"] {
  --theme-bg-primary: #FAFAFA;
  --theme-bg-secondary: #FFFFFF;
  --theme-bg-tertiary: #F3F4F6;

  --theme-text-primary: #0F0E0D;
  --theme-text-secondary: #4B5563;
  --theme-text-tertiary: #6B7280;

  --theme-accent: #A68A5C;
  --theme-border: #E5E7EB;
}
```

## 🔤 Tipografia

### Famílias de Fonte

#### Títulos e Headings
```css
font-family: 'Poltawski Nowy', serif;
font-weight: 600;
```

- **Uso**: Títulos de páginas, headings principais
- **Características**: Serif elegante, formal, jurídica

#### Corpo de Texto
```css
font-family: 'Instrument Sans', 'Open Sans', 'Roboto', sans-serif;
font-weight: 400;
```

- **Uso**: Parágrafos, textos longos, UI elements
- **Características**: Sans-serif moderna, alta legibilidade

#### Alternativas
- **EB Garamond**: Serif para documentos formais
- **Roboto**: Fallback para Instrument Sans
- **Open Sans**: Fallback universal

### Escala de Tamanhos

```javascript
const fontSize = {
  // Body Text
  'xs': '0.75rem',    // 12px - Legendas
  'sm': '0.875rem',   // 14px - Texto pequeno
  'base': '1rem',     // 16px - Texto padrão
  'lg': '1.125rem',   // 18px - Texto destacado

  // Headings
  'xl': '1.25rem',    // 20px - H5
  '2xl': '1.5rem',    // 24px - H4
  '3xl': '1.875rem',  // 30px - H3
  '4xl': '2.25rem',   // 36px - H2
  '5xl': '3rem',      // 48px - H1
  '6xl': '3.75rem',   // 60px - Display
};
```

### Line Heights

```css
/* Para Headings */
line-height: 1.2;  /* 120% - Títulos compactos */

/* Para Body Text */
line-height: 1.5;  /* 150% - Leitura confortável */

/* Para Textos Longos */
line-height: 1.6;  /* 160% - Máxima legibilidade */
```

### Font Weights

```javascript
const fontWeight = {
  light: 300,     // Raramente usado
  normal: 400,    // Texto padrão
  medium: 500,    // Ênfase leve
  semibold: 600,  // Títulos e botões
  bold: 700,      // Ênfase forte
};

// Regra: Máximo 3 pesos por página
```

## 📐 Espaçamento

### Sistema de 8px

```javascript
const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
};
```

### Aplicação de Espaçamento

```tsx
// ✅ BOM: Espaçamento consistente
<div className="p-6 mb-4">        // padding: 24px, margin-bottom: 16px
  <h2 className="mb-2">Título</h2> // margin-bottom: 8px
  <p className="mb-4">Texto</p>    // margin-bottom: 16px
</div>

// ❌ RUIM: Espaçamento arbitrário
<div style={{ padding: '23px', marginBottom: '17px' }}>
```

## 🎭 Componentes Visuais

### Buttons

#### Primary Button
```tsx
<button className="
  bg-theme-accent
  text-theme-bg-primary
  font-semibold
  px-6 py-3
  rounded-lg
  hover:opacity-90
  transition-all
  duration-200
  shadow-md
  hover:shadow-lg
">
  Botão Primário
</button>
```

#### Secondary Button
```tsx
<button className="
  bg-transparent
  text-theme-accent
  border-2
  border-theme-accent
  font-semibold
  px-6 py-3
  rounded-lg
  hover:bg-theme-accent
  hover:text-theme-bg-primary
  transition-all
  duration-200
">
  Botão Secundário
</button>
```

#### Ghost Button
```tsx
<button className="
  bg-transparent
  text-theme-text-primary
  font-medium
  px-4 py-2
  rounded-lg
  hover:bg-theme-bg-secondary
  transition-all
  duration-200
">
  Botão Ghost
</button>
```

### Cards

#### Card Padrão
```tsx
<div className="
  bg-theme-bg-secondary
  border
  border-theme-border
  rounded-xl
  p-6
  shadow-sm
  hover:shadow-md
  transition-shadow
  duration-200
">
  {/* Conteúdo */}
</div>
```

#### Card Elevado
```tsx
<div className="
  bg-theme-bg-secondary
  rounded-xl
  p-6
  shadow-lg
  hover:shadow-xl
  transition-shadow
  duration-200
">
  {/* Conteúdo */}
</div>
```

### Inputs

#### Text Input
```tsx
<input
  type="text"
  className="
    w-full
    bg-theme-bg-tertiary
    border
    border-theme-border
    text-theme-text-primary
    px-4 py-3
    rounded-lg
    focus:outline-none
    focus:ring-2
    focus:ring-theme-accent
    transition-all
    duration-200
  "
  placeholder="Digite aqui..."
/>
```

#### Textarea
```tsx
<textarea
  className="
    w-full
    bg-theme-bg-tertiary
    border
    border-theme-border
    text-theme-text-primary
    px-4 py-3
    rounded-lg
    focus:outline-none
    focus:ring-2
    focus:ring-theme-accent
    transition-all
    duration-200
    resize-none
  "
  rows={4}
  placeholder="Digite sua mensagem..."
/>
```

### Badges

#### Status Badge
```tsx
const statusStyles = {
  created: 'bg-gray-500 text-white',
  uploading: 'bg-blue-500 text-white',
  analyzing: 'bg-yellow-500 text-black',
  completed: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
};

<span className={`
  ${statusStyles[status]}
  px-3 py-1
  rounded-full
  text-sm
  font-medium
`}>
  {statusText}
</span>
```

### Progress Bars

```tsx
<div className="w-full bg-theme-bg-tertiary rounded-full h-2">
  <div
    className="bg-theme-accent h-2 rounded-full transition-all duration-500"
    style={{ width: `${percentage}%` }}
  />
</div>
```

## 🌓 Dark Mode / Light Mode

### Toggle Implementation
```typescript
const { theme, toggleTheme } = useTheme();

<button onClick={toggleTheme}>
  {theme === 'dark' ? <Sun /> : <Moon />}
</button>
```

### CSS Variables
```css
/* Aplicado dinamicamente */
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-theme', 'light');
```

## 📱 Breakpoints Responsivos

```javascript
const breakpoints = {
  sm: '640px',   // Mobile large
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Desktop large
  '2xl': '1536px', // Desktop XL
};
```

### Mobile-First Approach
```tsx
// ✅ BOM: Mobile-first
<div className="
  w-full          // Mobile: 100% width
  md:w-1/2        // Tablet: 50% width
  lg:w-1/3        // Desktop: 33% width
">

// ❌ RUIM: Desktop-first
<div className="
  w-1/3
  md:w-1/2
  sm:w-full
">
```

## 🎬 Animações e Transições

### Durations
```javascript
const duration = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
};
```

### Easing
```css
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

### Exemplos
```tsx
// Hover effect
<button className="
  transition-all
  duration-200
  hover:scale-105
  active:scale-95
">

// Fade in
<div className="
  opacity-0
  animate-fadeIn
">

// Slide in
<div className="
  transform
  -translate-x-full
  animate-slideInRight
">
```

## ♿ Acessibilidade

### Contraste de Cores
- **AA**: Mínimo 4.5:1 para texto normal
- **AAA**: Mínimo 7:1 para texto normal
- **AA Large**: Mínimo 3:1 para texto grande (18pt+)

### Focus States
```tsx
// Sempre visível ao navegar por teclado
<button className="
  focus:outline-none
  focus:ring-2
  focus:ring-theme-accent
  focus:ring-offset-2
  focus:ring-offset-theme-bg-primary
">
```

### Semantic Colors
```javascript
// Não dependa apenas de cor
{status === 'error' && (
  <span className="text-red-500">
    <AlertCircle className="inline mr-2" />
    Erro
  </span>
)}
```

## 📏 Grid System

### Layout Padrão
```tsx
<div className="container mx-auto px-4 max-w-7xl">
  <div className="grid grid-cols-12 gap-6">
    <div className="col-span-12 lg:col-span-8">
      {/* Conteúdo principal */}
    </div>
    <div className="col-span-12 lg:col-span-4">
      {/* Sidebar */}
    </div>
  </div>
</div>
```

### Flex Layouts
```tsx
// Centralizado
<div className="flex items-center justify-center min-h-screen">

// Space between
<div className="flex items-center justify-between">

// Stack vertical
<div className="flex flex-col space-y-4">
```

## 🎯 Ícones

### Biblioteca: Lucide React
```tsx
import { FileText, Upload, Download, Check, X } from 'lucide-react';

<FileText className="w-6 h-6 text-theme-accent" />
```

### Tamanhos Padrão
```javascript
const iconSizes = {
  sm: 'w-4 h-4',    // 16px
  base: 'w-5 h-5',  // 20px
  md: 'w-6 h-6',    // 24px
  lg: 'w-8 h-8',    // 32px
  xl: 'w-10 h-10',  // 40px
};
```

## 🔗 Próximos Documentos

- **[22-UX-PATTERNS.md](./22-UX-PATTERNS.md)** - Padrões de UX
- **[23-UI-GUIDELINES.md](./23-UI-GUIDELINES.md)** - Guidelines de UI

---

**Design system elegante e profissional**
