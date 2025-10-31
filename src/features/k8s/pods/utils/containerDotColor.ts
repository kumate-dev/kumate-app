import { ContainerStatusInfo } from './containerStatus';

export function getContainerDotColor(containerStatus: ContainerStatusInfo): string {
  const { state, ready } = containerStatus;

  if (!state) {
    return 'bg-white/30';
  }

  if (state.waiting) {
    const reason = state.waiting.reason || '';
    const warningReasons = [
      'ContainerCreating',
      'PodInitializing',
      'CrashLoopBackOff',
      'ImagePullBackOff',
      'ErrImagePull',
      'CreateContainerConfigError',
      'CreateContainerError',
      'ConfigError',
    ];

    const errorReasons = [
      'Error',
      'Failed',
      'InvalidImageName',
      'ImagePullError',
      'ContainerCannotRun',
      'DeadlineExceeded',
    ];

    if (warningReasons.includes(reason)) {
      return 'bg-yellow-500';
    } else if (errorReasons.includes(reason)) {
      return 'bg-red-500';
    }
    return 'bg-white/30';
  } else if (state.terminated) {
    if (state.terminated.exitCode === 0) {
      return 'bg-white/30';
    } else {
      return 'bg-red-500';
    }
  } else if (state.running) {
    if (ready) {
      return 'bg-green-500';
    } else {
      return 'bg-yellow-500';
    }
  }

  return 'bg-white/30';
}
