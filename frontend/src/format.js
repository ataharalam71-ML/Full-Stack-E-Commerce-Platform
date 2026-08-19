const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const money = (value) => inr.format(Number(value) || 0);

export const compact = (n) =>
  new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(n) || 0);

export const shortDate = (iso) => {
  if (!iso) return '';
  // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC) — make it a value Date can parse.
  const d = new Date(String(iso).replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime())
    ? String(iso).slice(0, 10)
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
