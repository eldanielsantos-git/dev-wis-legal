import { parseContent } from './contentParser';
import { parseMarkdownToElements } from './markdownToXml';

interface TextSegment {
  text: string;
  bold: boolean;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseTextWithBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, match.index),
        bold: false,
      });
    }
    segments.push({
      text: match[1],
      bold: true,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      bold: false,
    });
  }

  return segments.length > 0 ? segments : [{ text, bold: false }];
}

async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    console.log('[DOCX] Fetching logo from:', url);
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[DOCX] Failed to fetch logo:', response.status, response.statusText);
      return '';
    }

    const blob = await response.blob();
    console.log('[DOCX] Logo blob size:', blob.size, 'type:', blob.type);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        console.log('[DOCX] Logo converted to base64, length:', base64Data.length);
        resolve(base64Data);
      };
      reader.onerror = (error) => {
        console.error('[DOCX] Error reading image blob:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[DOCX] Error fetching image:', error);
    return '';
  }
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function generateMinimalDocx(bodyXml: string, imageBase64?: string): Blob {
  const hasImage = !!imageBase64;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasImage ? '<Default Extension="png" ContentType="image/png"/>' : ''}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hasImage ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}
  <Relationship Id="rId${hasImage ? '2' : '1'}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
      <w:pPr>
        <w:ind w:left="720" w:hanging="360"/>
      </w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
  </w:num>
  <w:num w:numId="2">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`;

  const files: Array<{ path: string; content: string | Uint8Array }> = [
    { path: '[Content_Types].xml', content: contentTypes },
    { path: '_rels/.rels', content: rels },
    { path: 'word/document.xml', content: documentXml },
    { path: 'word/_rels/document.xml.rels', content: documentRels },
    { path: 'word/numbering.xml', content: numberingXml },
  ];

  if (hasImage && imageBase64) {
    files.push({ path: 'word/media/image1.png', content: base64ToArrayBuffer(imageBase64) });
  }

  const zipParts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const pathBytes = new TextEncoder().encode(file.path);
    const contentBytes = typeof file.content === 'string'
      ? new TextEncoder().encode(file.content)
      : file.content;

    const localHeader = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, contentBytes.length, true);
    view.setUint32(22, contentBytes.length, true);
    view.setUint16(26, pathBytes.length, true);
    view.setUint16(28, 0, true);

    localHeader.set(pathBytes, 30);

    zipParts.push(localHeader);
    zipParts.push(contentBytes);

    const centralHeader = new Uint8Array(46 + pathBytes.length);
    const cdView = new DataView(centralHeader.buffer);

    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, 0, true);
    cdView.setUint32(20, contentBytes.length, true);
    cdView.setUint32(24, contentBytes.length, true);
    cdView.setUint16(28, pathBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);

    centralHeader.set(pathBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  });

  const cdSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);

  const endOfCentralDir = new Uint8Array(22);
  const eodView = new DataView(endOfCentralDir.buffer);
  eodView.setUint32(0, 0x06054b50, true);
  eodView.setUint16(4, 0, true);
  eodView.setUint16(6, 0, true);
  eodView.setUint16(8, files.length, true);
  eodView.setUint16(10, files.length, true);
  eodView.setUint32(12, cdSize, true);
  eodView.setUint32(16, offset, true);
  eodView.setUint16(20, 0, true);

  const totalSize = offset + cdSize + 22;
  const zipBuffer = new Uint8Array(totalSize);

  let position = 0;
  zipParts.forEach((part) => {
    zipBuffer.set(part, position);
    position += part.length;
  });

  centralDirectory.forEach((cd) => {
    zipBuffer.set(cd, position);
    position += cd.length;
  });

  zipBuffer.set(endOfCentralDir, position);

  return new Blob([zipBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function generateDocx(content: string, processoId?: string): Promise<Blob> {
  try {
    const logoUrl = 'https://rslpleprodloodfsaext.supabase.co/storage/v1/object/public/assets/img/logo-parecer.png';
    const logoBase64 = await fetchImageAsBase64(logoUrl);

    console.log('[DOCX] Logo base64 available:', !!logoBase64, 'length:', logoBase64?.length || 0);

    const parsed = parseContent(content);
    const elements = parseMarkdownToElements(parsed.value);

    let bodyXml = '';

    if (logoBase64) {
      console.log('[DOCX] Adding logo to document header');
      bodyXml += `
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:after="120"/>
          </w:pPr>
          <w:r>
            <w:drawing>
              <wp:inline distT="0" distB="0" distL="0" distR="0">
                <wp:extent cx="1828800" cy="1828800"/>
                <wp:effectExtent l="0" t="0" r="0" b="0"/>
                <wp:docPr id="1" name="Logo Wis Legal"/>
                <wp:cNvGraphicFramePr>
                  <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                </wp:cNvGraphicFramePr>
                <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                  <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:nvPicPr>
                        <pic:cNvPr id="0" name="Logo Wis Legal"/>
                        <pic:cNvPicPr/>
                      </pic:nvPicPr>
                      <pic:blipFill>
                        <a:blip r:embed="rId1"/>
                        <a:stretch>
                          <a:fillRect/>
                        </a:stretch>
                      </pic:blipFill>
                      <pic:spPr>
                        <a:xfrm>
                          <a:off x="0" y="0"/>
                          <a:ext cx="1828800" cy="1828800"/>
                        </a:xfrm>
                        <a:prstGeom prst="rect">
                          <a:avLst/>
                        </a:prstGeom>
                      </pic:spPr>
                    </pic:pic>
                  </a:graphicData>
                </a:graphic>
              </wp:inline>
            </w:drawing>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:after="400"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="24"/>
            </w:rPr>
            <w:t>Este é um parecer da Wis Legal</w:t>
          </w:r>
        </w:p>`;
    } else {
      console.log('[DOCX] Logo not available, adding text only header');
      bodyXml += `
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:after="400"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="24"/>
              <w:b/>
            </w:rPr>
            <w:t>Este é um parecer da Wis Legal</w:t>
          </w:r>
        </w:p>`;
    }

    for (const element of elements) {
      const segments = parseTextWithBold(element.content);

      const buildRuns = (segs: TextSegment[], defaultBold = false, fontSize = 22) => {
        return segs
          .map((seg) => {
            const escapedText = escapeXml(seg.text);
            if (!escapedText.trim()) return '';
            const isBold = seg.bold || defaultBold;
            if (isBold) {
              return `<w:r><w:rPr><w:b/><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r>`;
            }
            return `<w:r><w:rPr><w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/></w:rPr><w:t xml:space="preserve">${escapedText}</w:t></w:r>`;
          })
          .join('');
      };

      switch (element.type) {
        case 'heading1':
          bodyXml += `<w:p><w:pPr><w:spacing w:before="480" w:after="240" w:line="360" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${buildRuns(segments, true, 32)}</w:p>`;
          bodyXml += `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`;
          break;

        case 'heading2':
          bodyXml += `<w:p><w:pPr><w:spacing w:before="360" w:after="180" w:line="320" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${buildRuns(segments, true, 28)}</w:p>`;
          bodyXml += `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
          break;

        case 'heading3':
          bodyXml += `<w:p><w:pPr><w:spacing w:before="280" w:after="140" w:line="300" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${buildRuns(segments, true, 24)}</w:p>`;
          bodyXml += `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>`;
          break;

        case 'listItem':
          bodyXml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="140" w:line="280" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/></w:pPr>${buildRuns(segments, false, 22)}</w:p>`;
          break;

        case 'numberedListItem':
          bodyXml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="140" w:line="280" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/></w:pPr>${buildRuns(segments, false, 22)}</w:p>`;
          break;

        case 'divider':
          bodyXml += `<w:p><w:pPr><w:spacing w:before="240" w:after="240"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="D0D0D0"/></w:pBdr></w:pPr></w:p>`;
          bodyXml += `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>`;
          break;

        case 'paragraph':
          if (segments.some((s) => s.text.trim())) {
            bodyXml += `<w:p><w:pPr><w:spacing w:after="240" w:line="280" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>${buildRuns(segments, false, 22)}</w:p>`;
          } else {
            bodyXml += `<w:p><w:pPr><w:spacing w:after="240"/></w:pPr></w:p>`;
          }
          break;
      }
    }

    console.log('[DOCX] Generating ZIP with logo:', !!logoBase64);
    return generateMinimalDocx(bodyXml, logoBase64 || undefined);
  } catch (error) {
    console.error('[DOCX] Error generating DOCX:', error);
    throw new Error('Failed to generate DOCX file');
  }
}
