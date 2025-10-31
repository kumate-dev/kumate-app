import { V1ContainerState, V1Pod } from '@kubernetes/client-node';

export interface ContainerStatusInfo {
  name: string;
  ready: boolean;
  reason?: string;
  message?: string;
  state?: V1ContainerState;
}

export const getContainerStatuses = (p: V1Pod): ContainerStatusInfo[] => {
  const containerStatuses: ContainerStatusInfo[] = [];

  const warningStates = [
    'CrashLoopBackOff',
    'ErrImagePull',
    'ImagePullBackOff',
    'CreateContainerConfigError',
    'CreateContainerError',
    'InvalidImageName',
    'RunContainerError',
    'OOMKilled',
    'Error',
    'ContainerCannotRun',
    'DeadlineExceeded',
  ];

  p.status?.containerStatuses?.forEach((containerStatus) => {
    const reason =
      containerStatus.state?.waiting?.reason || containerStatus.state?.terminated?.reason;
    const message =
      containerStatus.state?.waiting?.message || containerStatus.state?.terminated?.message || '';

    const hasWarning = !!(reason && warningStates.includes(reason));
    const ready = containerStatus.ready && !hasWarning;

    containerStatuses.push({
      name: containerStatus.name,
      ready,
      reason,
      message,
      state: containerStatus.state,
    });
  });

  return containerStatuses;
};
