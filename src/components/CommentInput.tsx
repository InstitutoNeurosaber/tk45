import React, { useState } from 'react';
import { useMongoImageUpload } from '../hooks/useMongoImageUpload';
import { X } from 'lucide-react';

interface CommentInputProps {
  onSubmit: (text: string, imageUrl?: string) => void;
  className?: string;
}

export function CommentInput({ onSubmit, className = '' }: CommentInputProps) {
  const [comment, setComment] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const { uploadImage, isUploading } = useMongoImageUpload();

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    const imageItem = Array.from(items || []).find(item => item.type.startsWith('image'));
    
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        try {
          const imageUrl = await uploadImage(file);
          setPreview(imageUrl);
        } catch (error) {
          console.error('Erro no upload:', error);
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const imageUrl = await uploadImage(file);
        setPreview(imageUrl);
      } catch (error) {
        console.error('Erro no upload:', error);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim() || preview) {
      onSubmit(comment, preview || undefined);
      setComment('');
      setPreview(null);
    }
  };

  const removeImage = () => {
    setPreview(null);
  };

  return (
    <div className={className}>
      <div className="relative">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          placeholder="Escreva um comentário..."
          className="w-full min-h-[40px] p-3 border rounded-lg resize-none"
        />
        <small className="text-gray-500 text-xs">
          Arraste e solte imagens para enviá-las, ou pressione Enter para enviar o comentário.
        </small>

        {/* Preview da imagem */}
        {preview && (
          <div className="mt-2 relative inline-block">
            <img
              src={preview}
              alt="Preview"
              className="max-h-32 rounded-lg"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 