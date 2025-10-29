import { V1DaemonSet } from '@kubernetes/client-node';

export const daemonSetHasWarning = (ds: V1DaemonSet) =>
  (ds.status?.numberReady ?? 0) < (ds.status?.desiredNumberScheduled ?? 0);
