import { isAppError, type AppError, type AppErrorKind } from '@/types/error';

/**
 * Render any thrown/rejected value as a human-readable string.
 *
 * Tauri commands now reject with a structured `AppError` (see
 * `src-tauri/src/error.rs`). The plain-string branch is kept because a handful of
 * backend paths have not been migrated yet, and because JS-side failures
 * (`Error`, string throws) still flow through here.
 */
export const getErrorMessage = (error: unknown): string => {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  if (error) return String(error);
  return 'Unknown error';
};

/** Structured form when the backend supplied one, else `null`. */
export const asAppError = (error: unknown): AppError | null => (isAppError(error) ? error : null);

export const errorKind = (error: unknown): AppErrorKind | null => asAppError(error)?.kind ?? null;

/**
 * Whether retrying the identical call could plausibly succeed. Use this to decide
 * between offering a "Retry" action and showing a terminal error state.
 */
export const isRetryable = (error: unknown): boolean => asAppError(error)?.retryable ?? false;

/** The user disconnected this cluster — not a failure, so it should not be a toast. */
export const isDisconnected = (error: unknown): boolean => errorKind(error) === 'disconnected';

export const isNotFound = (error: unknown): boolean => {
  const appError = asAppError(error);
  return appError?.kind === 'not_found' || appError?.code === 404;
};

export const isForbidden = (error: unknown): boolean => asAppError(error)?.code === 403;

/**
 * Short, action-oriented text for an error banner. Falls back to the raw message
 * when the failure is not one we have specific advice for.
 */
export const getErrorHint = (error: unknown): string => {
  const appError = asAppError(error);
  if (!appError) return getErrorMessage(error);

  switch (appError.kind) {
    case 'disconnected':
      return 'This cluster is disconnected. Reconnect it to load resources.';
    case 'kubeconfig':
      return 'The stored kubeconfig for this context could not be used. Re-import it from ~/.kube.';
    case 'timeout':
      return 'The cluster did not respond in time. Check your network or VPN.';
    default:
      if (appError.code === 403) {
        return `Your credentials are not permitted to do this: ${appError.message}`;
      }
      return appError.message;
  }
};
