import { BadgeVariant } from '@/types/variant';

export const statusVariant = (s?: string): BadgeVariant => {
  switch (s) {
    case 'Progressing':
      return 'warning';
    case 'Available':
      return 'success';
    case 'Failed':
      return 'error';
    default:
      return 'default';
  }
};
