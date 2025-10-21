export function relativeAge(iso?: string) {
  if (!iso) return '-';

  const created = new Date(iso).getTime();
  const now = Date.now();
  let diff = Math.max(0, Math.floor((now - created) / 1000));

  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const hours = Math.floor(diff / 3600);
  diff -= hours * 3600;
  const mins = Math.floor(diff / 60);
  const secs = diff - mins * 60;

  if (days > 0) return days >= 10 ? `${days}d` : `${days}d${hours > 0 ? `${hours}h` : ''}`;
  if (hours > 0) return hours >= 10 ? `${hours}h` : `${hours}h${mins > 0 ? `${mins}m` : ''}`;
  if (mins > 0) return mins >= 10 ? `${mins}m` : `${mins}m${secs > 0 ? `${secs}s` : ''}`;
  return `${secs}s`;
}
