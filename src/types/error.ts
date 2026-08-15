/**
 * Mirrors `AppError` in `src-tauri/src/error.rs`.
 *
 * Tauri commands reject with this object. Previously they rejected with a bare
 * string, so the UI could only pattern-match on prose; `kind` and `code` let it
 * branch on the actual failure.
 */
export type AppErrorKind =
  | 'disconnected'
  | 'api'
  | 'kubeconfig'
  | 'timeout'
  | 'not_found'
  | 'invalid'
  | 'serde'
  | 'io'
  | 'internal';

export interface AppError {
  kind: AppErrorKind;
  /** HTTP-ish status where known; `0` when not applicable. */
  code: number;
  /** Kubernetes `Status.reason`, or the `kind` as a stand-in. */
  reason: string;
  message: string;
  /** True when retrying the identical call could plausibly succeed. */
  retryable: boolean;
}

export const isAppError = (value: unknown): value is AppError =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  'message' in value &&
  typeof (value as AppError).message === 'string';
