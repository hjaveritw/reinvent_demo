export const mmss = (totalSeconds: number) => {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const secs = (ms?: number) => (ms === undefined ? '—' : `${(ms / 1000).toFixed(1)}s`);

export const timeAgo = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (d < 60) return `${Math.round(d)}s ago`;
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  return `${Math.round(d / 3600)}h ago`;
};

export const download = (filename: string, content: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
