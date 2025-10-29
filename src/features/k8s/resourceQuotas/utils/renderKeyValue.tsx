export const renderKeyValue = (
  map?: Record<string, string | number>
): { display: string; title: string } => {
  if (!map || Object.keys(map).length === 0) return { display: '-', title: '-' };
  const text = Object.entries(map)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  return { display: text, title: text };
};
