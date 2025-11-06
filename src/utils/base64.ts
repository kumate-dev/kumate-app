export function decodeBase64(b64?: string): string {
  if (!b64) return '';
  try {
    return atob(b64);
  } catch {
    return '[invalid base64]';
  }
}
