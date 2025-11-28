export interface ParsedElement {
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'listItem' | 'numberedListItem' | 'divider';
  content: string;
  level?: number;
}

export function parseMarkdownToElements(markdown: string): ParsedElement[] {
  const lines = markdown.split('\n');
  const elements: ParsedElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      continue;
    }

    if (trimmedLine.startsWith('---') || trimmedLine === '***') {
      elements.push({ type: 'divider', content: '' });
      continue;
    }

    if (trimmedLine.startsWith('# ')) {
      elements.push({
        type: 'heading1',
        content: cleanMarkdownSyntax(trimmedLine.replace('# ', ''))
      });
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      elements.push({
        type: 'heading2',
        content: cleanMarkdownSyntax(trimmedLine.replace('## ', ''))
      });
      continue;
    }

    if (trimmedLine.startsWith('### ') || trimmedLine.startsWith('#### ')) {
      elements.push({
        type: 'heading3',
        content: cleanMarkdownSyntax(trimmedLine.replace(/^#{3,4}\s/, ''))
      });
      continue;
    }

    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('• ')) {
      elements.push({
        type: 'listItem',
        content: cleanMarkdownSyntax(trimmedLine.replace(/^[-*•]\s/, ''))
      });
      continue;
    }

    if (/^\d+\.\s/.test(trimmedLine)) {
      const match = trimmedLine.match(/^\d+\.\s(.+)$/);
      if (match) {
        elements.push({
          type: 'numberedListItem',
          content: cleanMarkdownSyntax(match[1])
        });
        continue;
      }
    }

    elements.push({
      type: 'paragraph',
      content: cleanMarkdownSyntax(line)
    });
  }

  return elements;
}

function cleanMarkdownSyntax(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
