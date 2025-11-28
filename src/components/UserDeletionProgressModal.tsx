import React from 'react';
import { ProgressModal, ProgressStep } from './ProgressModal';

interface DeletionProgress {
  step: string;
  completed: boolean;
  error?: string;
  count?: number;
}

interface UserDeletionProgressModalProps {
  isOpen: boolean;
  progress: DeletionProgress[];
  isDeleting: boolean;
  error: string | null;
  onClose: () => void;
}

export function UserDeletionProgressModal({
  isOpen,
  progress,
  isDeleting,
  error,
  onClose
}: UserDeletionProgressModalProps) {
  return (
    <ProgressModal
      isOpen={isOpen}
      title="Exclusão de Usuário"
      progress={progress as ProgressStep[]}
      isProcessing={isDeleting}
      error={error}
      onClose={onClose}
      errorTitle="Erro na Exclusão"
      progressTitle="Progresso da Exclusão"
      processingText="Processando..."
      initialText="Iniciando processo de exclusão..."
      closeButtonText="Fechar"
    />
  );
}
