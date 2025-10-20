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
  diff -= mins * 60;
  const secs = diff;

  if (days >= 10) return `${days}d`;
  if (days > 0) return `${days}d${hours > 0 ? `${hours}h` : ''}`;

  if (hours >= 10) return `${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;

  if (mins >= 10) return `${mins}m`;
  if (mins > 0) return `${mins}m${secs}s`;

  return `${secs}s`;
}
