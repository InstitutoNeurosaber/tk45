import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { useState } from 'react';

interface UseImageUploadReturn {
  uploadProgress: number;
  uploadError: string | null;
  uploadImage: (file: File) => Promise<string>;
  isUploading: boolean;
}

export function useImageUpload(): UseImageUploadReturn {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      // Converter arquivo para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;
      console.log('Arquivo convertido para base64');

      // Criar referência única para o arquivo
      const fileName = `${Date.now()}-${file.name}`;
      const storageRef = ref(storage, `images/${fileName}`);

      console.log('Referência do storage criada:', storageRef.fullPath);

      // Configurar metadados
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      };

      // Upload usando uploadString
      await uploadString(storageRef, base64Data, 'data_url', metadata);
      console.log('Upload concluído');
      setUploadProgress(100);

      // Obter URL de download
      const downloadURL = await getDownloadURL(storageRef);
      console.log('URL de download obtida:', downloadURL);

      setIsUploading(false);
      return downloadURL;
    } catch (error: any) {
      console.error('Erro no upload:', error);
      const errorMessage = getErrorMessage(error.code || 'unknown');
      setUploadError(errorMessage);
      setIsUploading(false);
      throw error;
    }
  };

  return {
    uploadProgress,
    uploadError,
    uploadImage,
    isUploading
  };
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'storage/unauthorized':
      return 'Você não tem permissão para fazer upload de arquivos';
    case 'storage/canceled':
      return 'Upload cancelado';
    case 'storage/unknown':
      return 'Ocorreu um erro desconhecido durante o upload';
    case 'storage/quota-exceeded':
      return 'Cota de armazenamento excedida';
    default:
      return 'Erro durante o upload do arquivo';
  }
} 