/**
 * Utility functions for handling and normalizing image sources across the application.
 * Supports:
 * - Supabase Storage URLs (e.g., https://...supabase.co/storage/v1/object/public/...)
 * - Standard HTTP / HTTPS URLs (e.g., https://example.com/photo.jpg)
 * - Relative URLs (e.g., /logo.png, /avatars/...)
 * - Base64 Data URLs (e.g., data:image/jpeg;base64,/9j/4AAQ...)
 * - Raw Base64 strings (auto-prepended with appropriate MIME type data URI)
 * - Graceful null handling for empty / invalid sources
 */

/**
 * Checks if a given string is a base64 encoded image or raw base64.
 */
export function isBase64Image(src: string | null | undefined): boolean {
  if (!src || typeof src !== 'string') return false;
  const clean = src.trim();
  if (clean.startsWith('data:image/')) return true;
  // Check if string contains base64 magic bytes
  if (
    clean.startsWith('/9j/') || // JPEG
    clean.startsWith('iVBORw0KGgo') || // PNG
    clean.startsWith('R0lGOD') || // GIF
    clean.startsWith('UklGR') || // WebP
    clean.startsWith('PHN2Zw') || // SVG
    clean.startsWith('PD94bWw') // XML / SVG
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a string is a remote HTTP or HTTPS image URL (e.g. Supabase Storage).
 */
export function isRemoteImageUrl(src: string | null | undefined): boolean {
  if (!src || typeof src !== 'string') return false;
  const clean = src.trim();
  return clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('//');
}

/**
 * Normalizes any image source string into a valid browser-displayable URL or Data URI.
 * Returns null if source is missing, blank, or invalid.
 */
export function normalizeImageSrc(src: string | null | undefined): string | null {
  if (!src || typeof src !== 'string') return null;
  const clean = src.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return null;

  // If already standard URL, relative path, blob URL, or data URI
  if (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('//') ||
    clean.startsWith('/') ||
    clean.startsWith('./') ||
    clean.startsWith('blob:') ||
    clean.startsWith('data:image/')
  ) {
    return clean;
  }

  // Detect raw base64 image prefixes and format into data URI
  if (clean.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${clean}`;
  }
  if (clean.startsWith('iVBORw0KGgo')) {
    return `data:image/png;base64,${clean}`;
  }
  if (clean.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${clean}`;
  }
  if (clean.startsWith('UklGR')) {
    return `data:image/webp;base64,${clean}`;
  }
  if (clean.startsWith('PHN2Zw') || clean.startsWith('PD94bWw')) {
    return `data:image/svg+xml;base64,${clean}`;
  }

  // Fallback: If it's a long string without spaces or standard protocol, treat as base64 jpeg
  if (!clean.includes(' ') && clean.length > 50) {
    return `data:image/jpeg;base64,${clean}`;
  }

  return clean;
}

/**
 * Resizes and compresses an image Data URL to thumbnail dimensions (default 400x400)
 * at the given quality (default 0.72 JPEG). Drastically reduces payload size from MBs to ~20-35KB.
 */
export function compressDataUrl(
  dataUrl: string,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(dataUrl);
      }
      ctx.drawImage(img, 0, 0, width, height);
      // Prefer image/jpeg for consistent compression across all browsers
      try {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Reads a File/Blob, downscales it to max dimensions, and returns a compressed JPEG Data URL.
 */
export function compressImageFile(
  file: File | Blob,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window is not defined'));
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        return reject(new Error('Failed to read image file'));
      }
      try {
        const compressed = await compressDataUrl(rawDataUrl, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch {
        resolve(rawDataUrl);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
