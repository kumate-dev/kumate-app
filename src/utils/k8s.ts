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

export function progressVariant(progress: string | number): Variant {
  try {
    const [succ, comp] = String(progress)
      .split('/')
      .map((x) => parseInt(x, 10));
    if (!isNaN(succ) && !isNaN(comp) && comp > 0) {
      if (succ >= comp) return 'success';
      return 'warning';
    }
    return 'default';
  } catch {
    return 'default';
  }
}

export function suspendVariant(suspend: boolean | string): Variant {
  if (suspend === true || suspend === 'true') return 'warning';
  if (suspend === false || suspend === 'false') return 'success';
  return 'default';
}

export function conditionVariant(cond: string): Variant {
  if (cond === 'Ready') return 'success';
  if (cond === 'Unknown') return 'warning';
  return 'error';
}

export function statusVariant(status: string): Variant {
  if (status === 'Active') return 'success';
  if (status === 'Terminating') return 'warning';
  return 'secondary';
}

export function podStatusVariant(s: string): Variant {
  if (s === 'Running') return 'success';
  if (s === 'Pending') return 'warning';
  if (s === 'Failed' || s === 'CrashLoopBackOff') return 'error';
  return 'default';
}

export function deploymentStatusVariant(s: string): Variant {
  if (s === 'Available') return 'success';
  if (s === 'Progressing') return 'warning';
  if (s === 'Failed' || s === 'ReplicaFailure') return 'error';
  if (s === 'Terminating') return 'secondary';
  return 'default';
}

export function getSelectedNamespace(name?: string) {
  return name === ALL_NAMESPACES ? undefined : name;
}
