import { BadgeVariant } from '@/types/variant';
import { K8sStatus } from '@/types/k8sStatus';
import { capitalizeFirstLetter } from '@/utils/string';

export type HelmReleaseLike = {
  status?: string;
};

export type HelmHistoryLike = {
  status?: string;
};

const helmStatusVariant = (s?: string): BadgeVariant => {
  const status = (s || '').toLowerCase();
  switch (true) {
    case status === 'deployed':
    case status === 'installed':
      return 'success';
    case status.startsWith('pending'):
    case status === 'superseded':
      return 'warning';
    case status === 'failed':
    case status === 'uninstalling':
      return 'error';
    default:
      return 'default';
  }
};

export const getHelmReleaseStatus = (status?: string): K8sStatus => {
  return { status: capitalizeFirstLetter(status || 'unknown'), variant: helmStatusVariant(status) };
};
