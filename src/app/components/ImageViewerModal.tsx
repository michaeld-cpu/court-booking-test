import React, { useState, useEffect } from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight, Share2, Copy } from 'lucide-react';
import { toast } from '@/app/lib/toast';

interface ImageViewerModalProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageViewerModal({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentImage = images[currentIndex];
    const shareData = {
      title: 'Check out this venue photo',
      url: currentImage,
    };
    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(currentImage);
        toast.success('Image link copied to clipboard');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        navigator.clipboard.writeText(currentImage);
        toast.success('Image link copied to clipboard');
      }
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentImage = images[currentIndex];
    try {
      await navigator.clipboard.writeText(currentImage);
      toast.success('Image link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length]);

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen || !images || images.length === 0) return;
    const nextIdx = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    [images[nextIdx], images[prevIdx]].forEach(src => {
      if (src) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [currentIndex, isOpen, images]);

  if (!images || images.length === 0) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content 
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-0 border-0 bg-transparent focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Image Viewer</DialogPrimitive.Title>

        {/* Global Close Button (top right of screen) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[100] flex items-center justify-center size-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
          tabIndex={0}
        >
          <X className="size-5" />
        </button>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 sm:left-6 sm:left-[5%] md:left-[10%] lg:left-[15%] z-50 flex items-center justify-center size-10 sm:size-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-colors border border-white/10"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 sm:right-6 sm:right-[5%] md:right-[10%] lg:right-[15%] z-50 flex items-center justify-center size-10 sm:size-12 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-colors border border-white/10"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}

        {/* Image Container */}
        <div className="relative w-full max-w-4xl max-h-[85vh] flex items-center justify-center px-4 sm:px-12 pointer-events-none">
          <div className="relative group pointer-events-auto w-full max-w-full">
            <img
              src={images[currentIndex]}
              alt={`View ${currentIndex + 1}`}
              className="w-full max-h-[85vh] object-contain rounded-xl select-none"
            />
            {/* Top right actions over image */}
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleShare}
                className="flex items-center justify-center size-9 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
              >
                <Share2 className="size-4" />
              </button>
              <button 
                onClick={handleCopy}
                className="flex items-center justify-center size-9 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
              >
                <Copy className="size-4" />
              </button>
            </div>
            
            {/* Counter */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/80 font-medium text-sm tracking-widest">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        </div>

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
