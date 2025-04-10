import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageAttachment {
  url: string;
  name: string;
}

interface TicketImageAttachmentsProps {
  onImagesChange: (images: { file: File; preview: string }[]) => void;
  existingImages?: ImageAttachment[];
}

export function TicketImageAttachments({ onImagesChange, existingImages = [] }: TicketImageAttachmentsProps) {
  const [images, setImages] = useState<{ file?: File; preview: string; name: string }[]>([]);

  // Carrega as imagens existentes quando o componente é montado
  useEffect(() => {
    setImages(existingImages.map(img => ({
      preview: img.url,
      name: img.name
    })));
  }, [existingImages]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));

    setImages(prev => {
      const updated = [...prev, ...newImages];
      onImagesChange(newImages.map(img => ({ file: img.file!, preview: img.preview })));
      return updated;
    });
  }, [onImagesChange]);

  const removeImage = (index: number) => {
    setImages(prev => {
      // Só revoga a URL se for uma imagem nova (tem file)
      if (prev[index].file) {
        URL.revokeObjectURL(prev[index].preview);
      }
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    onDrop
  });

  // Limpa as URLs de preview quando o componente é desmontado
  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image.file) { // Só revoga se for uma imagem nova
          URL.revokeObjectURL(image.preview);
        }
      });
    };
  }, [images]);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <Upload className={isDragActive ? 'text-primary' : 'text-gray-400'} />
          <p className="text-center">
            {isDragActive
              ? 'Solte as imagens aqui...'
              : 'Arraste e solte imagens aqui, ou clique para selecionar'}
          </p>
          <p className="text-sm text-gray-500">
            Formatos aceitos: JPEG, PNG, GIF, WEBP
          </p>
        </div>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={image.preview} className="relative group">
              <img
                src={image.preview}
                alt={image.name}
                className="w-full h-32 object-cover rounded-lg"
              />
              {/* Só mostra o botão de remover para imagens novas */}
              {image.file && (
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full 
                    opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                  title="Remover imagem"
                  aria-label="Remover imagem"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 