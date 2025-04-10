import React, { useState } from 'react';
import { ImageViewer } from './ImageViewer';

interface ImageThumbnailsProps {
  images: string[];
  className?: string;
  thumbnailSize?: 'sm' | 'md' | 'lg';
  columns?: number;
}

export function ImageThumbnails({
  images,
  className = '',
  thumbnailSize = 'md',
  columns = 4
}: ImageThumbnailsProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  };

  return (
    <>
      <div 
        className={`grid gap-4 ${className}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {images.map((image, index) => (
          <button
            key={image}
            onClick={() => setSelectedImageIndex(index)}
            className={`
              relative rounded-lg overflow-hidden cursor-pointer
              hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary
              focus:outline-none transition-all
              ${sizeClasses[thumbnailSize]}
            `}
            title="Clique para ampliar"
          >
            <img
              src={image}
              alt={`Miniatura ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {selectedImageIndex !== null && (
        <ImageViewer
          images={images}
          initialIndex={selectedImageIndex}
          onClose={() => setSelectedImageIndex(null)}
        />
      )}
    </>
  );
} 