import React, { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { useComments } from '../hooks/useComments';

interface TicketImageAttachmentsProps {
  ticketId: string;
}

export function TicketImageAttachments({ ticketId }: TicketImageAttachmentsProps) {
  const { addImageComment } = useComments(ticketId);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = async (url: string) => {
    try {
      // Extrair o nome do arquivo da URL
      const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || '');
      
      // Criar um objeto File simulado para o addImageComment
      const fakeFile = {
        name: fileName,
        type: 'image/jpeg', // Assumimos JPEG por padrão
        size: 0, // Tamanho não é crítico neste ponto
      } as File;

      await addImageComment(fakeFile);
    } catch (err) {
      console.error('Erro ao adicionar comentário com imagem:', err);
      setError('Erro ao salvar a imagem no comentário');
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    console.error('Erro no upload:', errorMessage);
  };

  return (
    <div className="mt-4">
      <ImageUpload
        onUploadComplete={handleUploadComplete}
        onError={handleError}
      />
      {error && (
        <div className="text-red-500 text-sm mt-2">
          {error}
        </div>
      )}
    </div>
  );
} 