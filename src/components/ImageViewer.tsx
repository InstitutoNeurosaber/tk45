import React, { useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  className?: string;
}

export function ImageViewer({
  images,
  initialIndex = 0,
  onClose,
  className = ''
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(images[currentIndex]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagem-${currentIndex + 1}.${blob.type.split('/')[1]}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        handlePrevious();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <div 
      className={`fixed inset-0 bg-black/90 flex items-center justify-center z-50 ${className}`}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 transition-colors"
          title="Fechar visualizador"
          aria-label="Fechar visualizador"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Botão Download */}
        <button
          onClick={handleDownload}
          className="absolute top-4 right-16 p-2 text-white hover:text-gray-300 transition-colors"
          title="Baixar imagem"
          aria-label="Baixar imagem"
        >
          <Download className="w-6 h-6" />
        </button>

        {/* Navegação */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 p-2 text-white hover:text-gray-300 transition-colors"
              title="Imagem anterior"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-4 p-2 text-white hover:text-gray-300 transition-colors"
              title="Próxima imagem"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Contador */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}

        {/* Imagem */}
        <img
          src={images[currentIndex]}
          alt={`Imagem ${currentIndex + 1}`}
          className="max-h-[90vh] max-w-[90vw] object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
} 