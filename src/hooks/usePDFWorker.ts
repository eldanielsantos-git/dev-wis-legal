import { useRef, useCallback } from 'react';
import type { PDFProcessMessage, PDFProcessResult } from '../workers/pdf-processor.worker';

export interface PDFWorkerResult {
  totalPages: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
  };
}

export const usePDFWorker = () => {
  const workerRef = useRef<Worker | null>(null);

  const initWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/pdf-processor.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return workerRef.current;
  }, []);

  const countPages = useCallback((file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const worker = initWorker();
      const timeout = setTimeout(() => {
        reject(new Error('PDF processing timeout'));
      }, 30000);

      const handleMessage = (e: MessageEvent<PDFProcessResult>) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);

        if (e.data.type === 'ERROR') {
          reject(new Error(e.data.error || 'Failed to process PDF'));
        } else {
          resolve(e.data.totalPages || 0);
        }
      };

      worker.addEventListener('message', handleMessage);

      file.arrayBuffer().then((arrayBuffer) => {
        worker.postMessage({
          type: 'COUNT_PAGES',
          fileArrayBuffer: arrayBuffer,
          fileName: file.name
        } as PDFProcessMessage);
      }).catch(reject);
    });
  }, [initWorker]);

  const extractMetadata = useCallback((file: File): Promise<PDFWorkerResult> => {
    return new Promise((resolve, reject) => {
      const worker = initWorker();
      const timeout = setTimeout(() => {
        reject(new Error('PDF metadata extraction timeout'));
      }, 30000);

      const handleMessage = (e: MessageEvent<PDFProcessResult>) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);

        if (e.data.type === 'ERROR') {
          reject(new Error(e.data.error || 'Failed to extract metadata'));
        } else {
          resolve({
            totalPages: e.data.totalPages || 0,
            metadata: e.data.metadata
          });
        }
      };

      worker.addEventListener('message', handleMessage);

      file.arrayBuffer().then((arrayBuffer) => {
        worker.postMessage({
          type: 'EXTRACT_METADATA',
          fileArrayBuffer: arrayBuffer,
          fileName: file.name
        } as PDFProcessMessage);
      }).catch(reject);
    });
  }, [initWorker]);

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    countPages,
    extractMetadata,
    terminateWorker
  };
};
