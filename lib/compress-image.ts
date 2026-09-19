/**
 * Shrinks a phone photo before upload. Market Associates work on mobile data,
 * and a raw camera image is often 4-8 MB; a 1600px JPEG at 82% quality is a
 * few hundred KB and still plenty for reviewing a product. Falls back to the
 * original file if anything about the browser's image handling fails.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 250_000) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
