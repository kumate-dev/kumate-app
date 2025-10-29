export const podDots = (s?: string): string => {
  switch (s) {
    case 'Running':
      return 'bg-green-500';
    case 'Failed':
      return 'bg-red-500';
    case 'Terminated':
    case 'Completed':
      return 'bg-gray-500';
    default:
      return 'bg-yellow-500';
  }
};
