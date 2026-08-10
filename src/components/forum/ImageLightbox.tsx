import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const ImageLightbox = ({ src, alt, onClose }: ImageLightboxProps) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setZoom((z) => Math.min(z + 0.5, 4))} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
          <ZoomOut className="w-5 h-5" />
        </button>
        <a href={src} download target="_blank" rel="noopener noreferrer" className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
          <Download className="w-5 h-5" />
        </a>
        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt || ""}
        className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${zoom})` }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
};

export default ImageLightbox;
