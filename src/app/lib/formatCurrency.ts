export const formatCurrency = (
  value: number | string,
  options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }
) => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat('en-US', {
    ...options,
  }).format(numeric);
};
