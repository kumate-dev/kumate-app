export type EventHandler<T> = (payload: T) => void;

export type EventType = 'ADDED' | 'MODIFIED' | 'DELETED';
