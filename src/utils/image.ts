export function detectImageMime(arr: Uint8Array): string {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    arr.length >= 8 &&
    arr[0] === 0x89 &&
    arr[1] === 0x50 &&
    arr[2] === 0x4e &&
    arr[3] === 0x47 &&
    arr[4] === 0x0d &&
    arr[5] === 0x0a &&
    arr[6] === 0x1a &&
    arr[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 ... FF D9
  if (
    arr.length >= 4 &&
    arr[0] === 0xff &&
    arr[1] === 0xd8 &&
    arr[arr.length - 2] === 0xff &&
    arr[arr.length - 1] === 0xd9
  ) {
    return 'image/jpeg';
  }
  // GIF: GIF87a or GIF89a
  if (
    arr.length >= 6 &&
    arr[0] === 0x47 &&
    arr[1] === 0x49 &&
    arr[2] === 0x46 &&
    arr[3] === 0x38 &&
    (arr[4] === 0x37 || arr[4] === 0x39) &&
    arr[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (
    arr.length >= 12 &&
    arr[0] === 0x52 &&
    arr[1] === 0x49 &&
    arr[2] === 0x46 &&
    arr[3] === 0x46 &&
    arr[8] === 0x57 &&
    arr[9] === 0x45 &&
    arr[10] === 0x42 &&
    arr[11] === 0x50
  ) {
    return 'image/webp';
  }
  // Default
  return 'image/png';
}

export function toDataUrlFromBytes(bytes: number[]): string {
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const b64 = btoa(binary);
  const mime = detectImageMime(arr);
  return `data:${mime};base64,${b64}`;
}
