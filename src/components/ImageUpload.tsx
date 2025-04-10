import React, { useCallback, useState, ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import styled from 'styled-components';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useMongoImageUpload } from '../hooks/useMongoImageUpload';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onError: (error: string) => void;
  maxFiles?: number;
  maxSize?: number; // em bytes
  className?: string;
  showPreview?: boolean;
}

interface DropzoneContainerProps {
  isDragActive: boolean;
  children: ReactNode;
}

interface ProgressBarProps {
  progress: number;
}

const DropzoneContainer = ({ isDragActive, children }: DropzoneContainerProps) => {
  const style = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    borderWidth: 2,
    borderRadius: 8,
    borderColor: isDragActive ? '#2196f3' : '#eeeeee',
    borderStyle: 'dashed',
    backgroundColor: '#fafafa',
    color: '#bdbdbd',
    outline: 'none',
    transition: 'border .24s ease-in-out',
    cursor: 'pointer',
    ':hover': {
      borderColor: '#2196f3'
    }
  } as const;

  return <div style={style}>{children}</div>;
};

const ProgressBar = ({ progress }: ProgressBarProps) => {
  const containerStyle = {
    width: '100%',
    height: '4px',
    backgroundColor: '#eee',
    marginTop: '10px',
    borderRadius: '2px',
    overflow: 'hidden'
  } as const;

  const progressStyle = {
    width: `${progress}%`,
    height: '100%',
    backgroundColor: '#2196f3',
    transition: 'width 0.3s ease'
  } as const;

  return (
    <div style={containerStyle}>
      <div style={progressStyle} />
    </div>
  );
};

export function ImageUpload({
  onUploadComplete,
  onError,
  maxFiles = 1,
  maxSize = 5 * 1024 * 1024, // 5MB por padrão
  className = '',
  showPreview = true
}: ImageUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<File[]>([]);
  const { uploadImage, progress, isUploading, error } = useMongoImageUpload();
  const [uploadProgress, setUploadProgress] = useState(0);

  // Notifica erros para o componente pai
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleUpload = useCallback(async (file: File) => {
    try {
      const url = await uploadImage(file);
      onUploadComplete(url);
      // Limpa o arquivo após upload bem sucedido
      setFiles([]);
      setPreviews([]);
    } catch (error) {
      console.error('Erro no upload:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'Erro desconhecido no upload');
      }
    }
  }, [uploadImage, onUploadComplete, onError]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      onError('Nenhum arquivo selecionado');
      return;
    }

    const file = acceptedFiles[0];
    
    // Validar tamanho do arquivo (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError('O arquivo é muito grande. O tamanho máximo é 5MB.');
      return;
    }

    // Validar tipo do arquivo
    if (!file.type.startsWith('image/')) {
      onError('Apenas imagens são permitidas.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Criar preview
      const previewUrl = URL.createObjectURL(file);
      setPreviews([previewUrl]);
      setFiles([file]);

      // Upload usando o hook do MongoDB
      const url = await uploadImage(file);
      setUploadProgress(100);
      onUploadComplete(url);
      
      // Limpar previews e arquivos
      setFiles([]);
      setPreviews([]);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      onError(error.message || 'Erro ao fazer upload da imagem');
    } finally {
      setIsUploading(false);
    }
  }, [uploadImage, onUploadComplete, onError]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const newFiles = [...files];
    const newPreviews = [...previews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors
          ${isDragActive && !isDragReject ? 'border-primary bg-primary/10' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center gap-2">
          {isDragReject ? (
            <AlertCircle className="w-10 h-10 text-red-500" />
          ) : (
            <Upload 
              className={`w-10 h-10 ${isDragActive ? 'text-primary' : 'text-gray-400'}`} 
            />
          )}
          
          {isDragActive && !isDragReject && (
            <p className="text-center text-primary">Solte a imagem aqui...</p>
          )}
          
          {isDragReject && (
            <p className="text-center text-red-500">
              Arquivo não suportado ou limite excedido
            </p>
          )}
          
          {!isDragActive && !isDragReject && (
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">
                Arraste uma imagem aqui, ou clique para selecionar
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {maxFiles === 1 ? 'Máximo 1 arquivo' : `Máximo ${maxFiles} arquivos`} 
                (max {Math.round(maxSize / 1024 / 1024)}MB cada)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mensagens de erro para arquivos rejeitados */}
      {rejectedFiles.length > 0 && (
        <div className="mt-2">
          {rejectedFiles.map((file, index) => (
            <p key={index} className="text-sm text-red-500">
              {file.name}: Arquivo não suportado ou muito grande
            </p>
          ))}
        </div>
      )}

      {/* Preview das imagens */}
      {showPreview && previews.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {previews.map((preview, index) => (
            <div key={preview} className="relative group">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg"
              />
              <button
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full 
                  opacity-0 group-hover:opacity-100 transition-opacity"
                type="button"
                title="Remover imagem"
                aria-label="Remover imagem"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barra de progresso */}
      {isUploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-primary h-2.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enviando... {Math.round(uploadProgress)}%
          </p>
        </div>
      )}
    </div>
  );
} 