export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: string;
}

/**
 * Downscale and re-encode an image client-side with the canvas API.
 * Returns a new File (named `{base}-compressed.{ext}`) or the original
 * file when the image cannot be decoded (no canvas support, invalid
 * image, or the source is already smaller than the target).
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.82, type = 'image/jpeg' } = options;

  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    // Flatten transparency onto white for JPEG output
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, '');
    const ext = type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1] ?? 'jpg';
    return new File([blob], `${base}-compressed.${ext}`, { type });
  } catch {
    return file;
  }
}