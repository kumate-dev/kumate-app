import { invoke } from '@tauri-apps/api/core';

export async function warmupContext(name: string): Promise<void> {
  await invoke('warmup_context', { name });
}