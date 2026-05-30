export function formatIDR(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount).replace(/\u00a0/g, ' ');
}

export function parseIDR(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 0;
  const multiplier = raw.includes('jt') || raw.includes('juta') ? 1_000_000 : 1;
  const normalized = raw
    .replace(/juta|jt|rp|\s/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * multiplier) : 0;
}
