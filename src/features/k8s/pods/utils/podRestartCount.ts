import { V1Pod } from '@kubernetes/client-node';

export const podRestartCount = (p: V1Pod): number =>
  p.status?.containerStatuses?.reduce((acc, s) => acc + (s.restartCount || 0), 0) ?? 0;
