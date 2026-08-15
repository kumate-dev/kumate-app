/**
 * Decode base64 to text, or report that it is not text at all.
 *
 * Returns `null` when the payload is not valid UTF-8 — a TLS keystore, a `.jar`, a
 * gzipped blob. Callers must handle that: rendering arbitrary bytes as a string
 * produces mojibake, and *editing* them as a string silently corrupts them.
 *
 * The previous implementation was `atob()` alone, which yields one char per byte
 * (latin1). Any Secret or ConfigMap holding non-ASCII UTF-8 — an accented password, a
 * CJK config value — rendered garbled.
 */
export function decodeBase64Utf8(b64?: string): string | null {
  if (!b64) return '';
  try {
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    // `fatal` is the whole point: it turns "these bytes are not text" into a signal
    // instead of a string full of replacement characters.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Decode for display. Non-text payloads become a marker rather than `null`, so simple
 * read-only call sites do not each need a branch.
 */
export function decodeBase64(b64?: string): string {
  const text = decodeBase64Utf8(b64);
  return text ?? '[binary data]';
}

/** True when the payload is base64 but not UTF-8 text. */
export function isBinaryBase64(b64?: string): boolean {
  return decodeBase64Utf8(b64) === null;
}

/** Encode UTF-8 text to base64. */
export function encodeTextToBase64(text: string): string {
  return encodeBytesToBase64(new TextEncoder().encode(text));
}

/** Encode a byte array to base64 string */
export function encodeBytesToBase64(bytes: number[] | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i] ?? 0);
  return btoa(binary);
}
