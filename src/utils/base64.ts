export function decodeBase64(b64?: string): string {
  if (!b64) return '';
  try {
    return atob(b64);
  } catch {
    return '[invalid base64]';
  }
}

/** Encode a byte array to base64 string */
export function encodeBytesToBase64(bytes: number[] | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}
