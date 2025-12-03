import { PDFDocument } from 'pdf-lib';

export interface PDFChunk {
  file: File;
  startPage: number;
  endPage: number;
  totalPages: number;
  chunkIndex: number;
  totalChunks: number;
  overlapStartPage: number | null;
  overlapEndPage: number | null;
}

const LARGE_FILE_THRESHOLD = 1000;

// Token-safe chunk sizes (assuming ~1500 tokens/page with context)
// Max Gemini: 1.048.576 tokens (using 850k as safe limit)
const CHUNK_SIZE_NORMAL = 400;   // ~600k tokens - For 1000-5000 pages
const CHUNK_SIZE_LARGE = 300;    // ~450k tokens - For 5000-15000 pages
const CHUNK_SIZE_XLARGE = 200;   // ~300k tokens - For >15000 pages
const OVERLAP_PAGES = 75;         // ~112k tokens overlap for context

function determineChunkSize(totalPages: number): number {
  if (totalPages > 15000) return CHUNK_SIZE_XLARGE;
  if (totalPages > 5000) return CHUNK_SIZE_LARGE;
  return CHUNK_SIZE_NORMAL;
}

export async function getPDFPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  return pdfDoc.getPageCount();
}

export async function splitPDFIntoChunks(file: File, withOverlap: boolean = false): Promise<PDFChunk[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages < LARGE_FILE_THRESHOLD) {
    return [{
      file,
      startPage: 1,
      endPage: totalPages,
      totalPages,
      chunkIndex: 0,
      totalChunks: 1,
      overlapStartPage: null,
      overlapEndPage: null,
    }];
  }

  const chunkSize = determineChunkSize(totalPages);
  const effectiveChunkSize = withOverlap ? chunkSize : chunkSize;
  const chunks: PDFChunk[] = [];

  let currentPage = 0;
  let chunkIndex = 0;

  while (currentPage < totalPages) {
    const isFirstChunk = chunkIndex === 0;
    const overlapStart = !isFirstChunk && withOverlap ? Math.max(0, currentPage - OVERLAP_PAGES) : null;
    const chunkStartPage = overlapStart !== null ? overlapStart : currentPage;
    const chunkEndPage = Math.min(currentPage + effectiveChunkSize, totalPages);

    const chunkDoc = await PDFDocument.create();

    for (let pageNum = chunkStartPage; pageNum < chunkEndPage; pageNum++) {
      const [copiedPage] = await chunkDoc.copyPages(pdfDoc, [pageNum]);
      chunkDoc.addPage(copiedPage);
    }

    const chunkBytes = await chunkDoc.save();
    const chunkBlob = new Blob([chunkBytes], { type: 'application/pdf' });

    const originalName = file.name.replace('.pdf', '');
    const totalChunks = Math.ceil(totalPages / effectiveChunkSize);
    const chunkFileName = `${originalName}_chunk${chunkIndex + 1}of${totalChunks}.pdf`;
    const chunkFile = new File([chunkBlob], chunkFileName, { type: 'application/pdf' });

    chunks.push({
      file: chunkFile,
      startPage: currentPage + 1,
      endPage: chunkEndPage,
      totalPages,
      chunkIndex,
      totalChunks,
      overlapStartPage: overlapStart !== null ? overlapStart + 1 : null,
      overlapEndPage: overlapStart !== null ? currentPage : null,
    });

    currentPage += effectiveChunkSize;
    chunkIndex++;
  }

  return chunks;
}

export async function splitPDFIntoChunksWithOverlap(file: File): Promise<PDFChunk[]> {
  return splitPDFIntoChunks(file, true);
}

export function shouldSplitPDF(pageCount: number): boolean {
  return pageCount >= LARGE_FILE_THRESHOLD;
}

export function isComplexProcessing(pageCount: number): boolean {
  return pageCount >= LARGE_FILE_THRESHOLD;
}

export function getChunkConfiguration(totalPages: number) {
  const chunkSize = determineChunkSize(totalPages);
  const totalChunks = Math.ceil(totalPages / chunkSize);
  const overlap = OVERLAP_PAGES;

  return {
    chunkSize,
    totalChunks,
    overlap,
    isComplex: isComplexProcessing(totalPages),
    estimatedProcessingTimeMinutes: Math.ceil((totalChunks * 5) / 5 + 5),
  };
}
