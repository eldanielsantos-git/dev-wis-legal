import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface PDFProcessMessage {
  type: 'COUNT_PAGES' | 'EXTRACT_METADATA';
  fileArrayBuffer: ArrayBuffer;
  fileName: string;
}

export interface PDFProcessResult {
  type: 'SUCCESS' | 'ERROR';
  totalPages?: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
  };
  error?: string;
  fileName: string;
}

self.onmessage = async (e: MessageEvent<PDFProcessMessage>) => {
  const { type, fileArrayBuffer, fileName } = e.data;

  try {
    const loadingTask = pdfjsLib.getDocument({ data: fileArrayBuffer });
    const pdfDocument = await loadingTask.promise;

    if (type === 'COUNT_PAGES') {
      const totalPages = pdfDocument.numPages;

      self.postMessage({
        type: 'SUCCESS',
        totalPages,
        fileName
      } as PDFProcessResult);
    } else if (type === 'EXTRACT_METADATA') {
      const totalPages = pdfDocument.numPages;
      const metadata = await pdfDocument.getMetadata();

      const result: PDFProcessResult = {
        type: 'SUCCESS',
        totalPages,
        metadata: {
          title: metadata.info?.Title,
          author: metadata.info?.Author,
          subject: metadata.info?.Subject,
          creator: metadata.info?.Creator,
          producer: metadata.info?.Producer,
          creationDate: metadata.info?.CreationDate
        },
        fileName
      };

      self.postMessage(result);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error processing PDF',
      fileName
    } as PDFProcessResult);
  }
};
