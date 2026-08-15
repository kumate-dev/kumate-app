export type EventHandler<T> = (payload: T) => void;

/**
 * Mirrors `EventType` in `src-tauri/src/types/event.rs`.
 *
 * `SYNCED` is a payload-less lifecycle marker emitted once the initial listing for
 * a watch is complete, and again after every recovery relist. Reducers should treat
 * it as "the set you now hold is authoritative" — e.g. to stop showing a skeleton —
 * and must ignore its `object`, which is always `null`.
 */
export type EventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'SYNCED' | 'FAILED';

export type WatchEvent<T> = {
  type: EventType;
  object: T;
};

/** Payload carried by a `FAILED` event. */
export interface WatchFailure {
  message: string;
}

export const isWatchFailure = (value: unknown): value is WatchFailure =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as WatchFailure).message === 'string';
