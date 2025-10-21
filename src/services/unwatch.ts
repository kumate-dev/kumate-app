import { invoke } from '@tauri-apps/api/core';

export async function unwatch({ name }: { name: string }): Promise<void> {
  try {
    await invoke('unwatch', { name });
  } catch (err) {
    console.warn('unwatch failed:', err);
  }
}
