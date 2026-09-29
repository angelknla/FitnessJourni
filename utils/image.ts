/**
 * Shrinking pictures before they are uploaded.
 *
 * Profile and group pictures are only ever drawn small — the largest is the group
 * circle at 7rem (112px), so a 3x phone wants about 336 device pixels. Storing the
 * 4000px original a phone camera produces wastes the bucket, the upload and every
 * byte the image optimiser has to read back.
 *
 * Done in the browser rather than on the server: there is no usable image library
 * installed, and the browser already has a decoder for everything it will accept.
 * It is an optimisation, not a control — a determined client could post the
 * original, which is why the Server Actions still check the type and the 5 MB cap.
 */

/** Comfortably above the 336 device pixels the largest of these needs. */
export const IMAGE_MAX_EDGE = 512;

/** Visually lossless at these sizes; WebP at 0.82 lands around 40 KB. */
export const IMAGE_QUALITY = 0.82;

/**
 * The size that fits inside `maxEdge` keeping the aspect ratio. Returns the input
 * unchanged when it already fits, so an already-small picture is never re-encoded
 * for nothing.
 */
export const fitWithin = (
  width: number,
  height: number,
  maxEdge = IMAGE_MAX_EDGE
): { width: number; height: number } => {
  const longest = Math.max(width, height);

  if (longest <= maxEdge || longest === 0) {
    return { width, height };
  }

  const scale = maxEdge / longest;
  return {
    // At least 1px: a very wide, very short source must not round to zero.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const toBlob = async (bitmap: ImageBitmap, width: number, height: number): Promise<Blob | null> => {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: 'image/webp', quality: IMAGE_QUALITY });
  }

  // Safari only gained OffscreenCanvas recently, so fall back to a real element.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', IMAGE_QUALITY);
  });
};

/**
 * A smaller WebP of the same picture, or the original file when shrinking it would
 * not help or is not possible. Never throws: a picture that cannot be decoded here
 * should still upload as it is rather than fail.
 */
export const shrinkImage = async (file: File, maxEdge = IMAGE_MAX_EDGE): Promise<File> => {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return file;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const blob = await toBlob(bitmap, width, height);

    // Re-encoding can make an already-optimised file bigger. Keep the smaller one.
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const name = `${file.name.replace(/\.[^.]+$/, '')}.webp`;
    return new File([blob], name, { type: 'image/webp', lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close?.();
  }
};

/**
 * Puts `file` into a file input in place of what the person picked, so the form
 * submits the smaller version. A DataTransfer is the only way to write
 * `input.files`.
 */
export const replaceInputFile = (input: HTMLInputElement, file: File): boolean => {
  /*
   * Best effort. Where DataTransfer is missing or read-only the input keeps the
   * file the person picked, which still uploads — losing the optimisation is
   * acceptable, failing the upload is not.
   */
  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input.files?.[0] === file;
  } catch {
    return false;
  }
};
