/**
 * Image optimization utilities - converts images to WebP and compresses on the fly.
 */

/**
 * Convert a File to WebP format with compression.
 * @param file - Original image file
 * @param quality - WebP quality (0-1), default 0.75
 * @param maxWidth - Max width in px, default 1200
 * @returns A new File in WebP format
 */
export const convertToWebP = (
  file: File,
  quality = 0.75,
  maxWidth = 1200
): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If not an image, return as-is
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.width;
      let h = img.height;

      // Scale down if wider than maxWidth
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("WebP conversion failed")); return; }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          const webpFile = new File([blob], `${baseName}.webp`, { type: "image/webp" });
          resolve(webpFile);
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: return original file
      resolve(file);
    };

    img.src = url;
  });
};

/**
 * Get an optimized Supabase storage URL with transforms (if supported).
 * Falls back to original URL if transforms not available.
 */
export const getOptimizedImageUrl = (
  url: string,
  width = 400,
  quality = 75
): string => {
  if (!url) return url;
  // Supabase storage transform URL pattern
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace(
      "/storage/v1/object/public/",
      `/storage/v1/render/image/public/`
    ) + `?width=${width}&quality=${quality}`;
  }
  return url;
};
