export type EventHandler<T> = (payload: T) => void;

export type EventType = 'ADDED' | 'MODIFIED' | 'DELETED';

export type WatchEvent<T> = {
  type: EventType;
  object: T;
};
