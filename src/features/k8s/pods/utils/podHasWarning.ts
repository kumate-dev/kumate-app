import { V1Pod } from '@kubernetes/client-node';

export const podHasPodWarning = (p: V1Pod): boolean => {
  const phase = p.status?.phase ?? 'Unknown';
  if (['Failed', 'Unknown'].includes(phase)) return true;

  const badStates = [
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

  return (
    p.status?.containerStatuses?.some((st) =>
      badStates.includes(st.state?.waiting?.reason || st.state?.terminated?.reason || '')
    ) ?? false
  );
};
