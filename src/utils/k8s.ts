import { ALL_NAMESPACES } from '../constants/k8s';

export type Variant = 'default' | 'success' | 'warning' | 'error' | 'secondary';

export function readyVariant(ready: string | number): Variant {
  try {
    const [a, b] = String(ready)
      .split('/')
      .map((x) => parseInt(x, 10));
    if (!isNaN(a) && !isNaN(b) && a === b) return 'success';
    return 'warning';
  } catch {
    return 'default';
  }
}

export function getSelectedNamespace(namespaces?: string[]) {
  return namespaces?.includes(ALL_NAMESPACES) ? undefined : namespaces;
}
