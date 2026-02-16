import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
const LARGE_FILE_SIZE_THRESHOLD = 18 * 1024 * 1024; // 18MB
const MAX_CHUNK_SIZE_BYTES = 15 * 1024 * 1024; // 15MB - max chunk size for Gemini
const AVG_BYTES_PER_PAGE = 80 * 1024; // ~80KB per page estimate for legal PDFs (conservative)

// Token-safe chunk sizes (assuming ~1500 tokens/page with context)
// Max Gemini: 1.048.576 tokens (using 850k as safe limit)
const CHUNK_SIZE_MEDIUM = 400;        // ~600k tokens - For 1001-2000 pages
const CHUNK_SIZE_LARGE = 180;         // ~270k tokens - For 2001-10000 pages
const CHUNK_SIZE_HIGH_LARGE = 180;    // ~270k tokens - For 10001-20000 pages
const CHUNK_SIZE_ULTRA_LARGE = 100;   // ~150k tokens - For >20000 pages
const OVERLAP_PAGES = 75;             // ~112k tokens overlap for context

function determineChunkSize(totalPages: number): number {
  if (totalPages > 20000) return CHUNK_SIZE_ULTRA_LARGE;
  if (totalPages > 10000) return CHUNK_SIZE_HIGH_LARGE;
  if (totalPages > 2000) return CHUNK_SIZE_LARGE;
  if (totalPages > 1000) return CHUNK_SIZE_MEDIUM;
  return CHUNK_SIZE_MEDIUM;
}

export function estimatePageCountFromSize(fileSize: number): number {
  return Math.max(1, Math.ceil(fileSize / AVG_BYTES_PER_PAGE));
}

export function isLargeFile(fileSize: number): boolean {
  return fileSize >= LARGE_FILE_SIZE_THRESHOLD;
}

export async function getPDFPageCount(file: File): Promise<number> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.warn('[pdfSplitter] Failed to read PDF pages, using estimate:', error);
    return estimatePageCountFromSize(file.size);
  }
}

export async function getPDFPageCountSafe(file: File): Promise<{ pageCount: number; isEstimate: boolean }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return { pageCount: pdf.numPages, isEstimate: false };
  } catch (error) {
    console.warn('[pdfSplitter] Failed to read PDF pages, using estimate:', error);
    return { pageCount: estimatePageCountFromSize(file.size), isEstimate: true };
  }
}

export async function splitPDFIntoChunks(file: File, withOverlap: boolean = false): Promise<PDFChunk[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const totalPages = pdfDoc.getPageCount();

  const needsSplitBySize = file.size > MAX_CHUNK_SIZE_BYTES;
  const needsSplitByPages = totalPages >= LARGE_FILE_THRESHOLD;

  if (!needsSplitBySize && !needsSplitByPages) {
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

  let chunkSize: number;
  if (needsSplitBySize) {
    const avgBytesPerPage = file.size / totalPages;
    const pagesPerMaxChunk = Math.floor(MAX_CHUNK_SIZE_BYTES / avgBytesPerPage);
    const sizeBasedChunkSize = Math.max(10, pagesPerMaxChunk);

    if (needsSplitByPages) {
      chunkSize = Math.min(sizeBasedChunkSize, determineChunkSize(totalPages));
    } else {
      chunkSize = sizeBasedChunkSize;
    }
  } else {
    chunkSize = determineChunkSize(totalPages);
  }
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

const MAX_SIMPLE_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function getChunkConfiguration(totalPages: number, fileSize?: number) {
  const needsSplitByPages = totalPages >= LARGE_FILE_THRESHOLD;
  const needsSplitBySize = fileSize ? fileSize > MAX_SIMPLE_FILE_SIZE : false;

  if (!needsSplitByPages && !needsSplitBySize) {
    return {
      chunkSize: totalPages,
      totalChunks: 1,
      overlap: 0,
      isComplex: false,
      estimatedProcessingTimeMinutes: 5,
    };
  }

  const needsChunkSizeOptimization = fileSize ? fileSize > MAX_CHUNK_SIZE_BYTES : false;

  let chunkSize: number;
  if (needsChunkSizeOptimization) {
    const avgBytesPerPage = fileSize! / totalPages;
    const pagesPerMaxChunk = Math.floor(MAX_CHUNK_SIZE_BYTES / avgBytesPerPage);
    const sizeBasedChunkSize = Math.max(10, pagesPerMaxChunk);
    chunkSize = Math.min(sizeBasedChunkSize, determineChunkSize(totalPages));
  } else {
    chunkSize = determineChunkSize(totalPages);
  }

  const totalChunks = Math.ceil(totalPages / chunkSize);
  const overlap = OVERLAP_PAGES;

  return {
    chunkSize,
    totalChunks,
    overlap,
    isComplex: true,
    estimatedProcessingTimeMinutes: Math.ceil((totalChunks * 5) / 5 + 5),
  };
}
