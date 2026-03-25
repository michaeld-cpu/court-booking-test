import { format, parse } from 'date-fns';

export const formatTimeValue = (value: string, withPeriod: boolean) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return value;
  const isoLikePattern =
    /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}(:\d{2})?(\.\d+)?(z|[+-]\d{2}:\d{2})?$/i;
  const timeWithZonePattern =
    /^\d{2}:\d{2}(:\d{2})?(z|[+-]\d{2}:\d{2})$/i;

  if (isoLikePattern.test(trimmed)) {
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return format(parsedDate, withPeriod ? 'h:mm a' : 'h:mm');
    }
  }

  if (timeWithZonePattern.test(trimmed)) {
    const parsedDate = new Date(`1970-01-01T${trimmed}`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return format(parsedDate, withPeriod ? 'h:mm a' : 'h:mm');
    }
  }

  const hasPeriod = /\b(am|pm)\b/i.test(trimmed);
  const parsed = hasPeriod
    ? parse(trimmed, 'h:mm a', new Date())
    : parse(trimmed, trimmed.length > 5 ? 'HH:mm:ss' : 'HH:mm', new Date());
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, withPeriod ? 'h:mm a' : 'h:mm');
  }
  const stripped = withPeriod ? trimmed : trimmed.replace(/\s*(am|pm)\b/i, '').trim();
  return stripped.replace(/^0(\d:)/, '$1');
};

export const formatTimeRangeLabel = (start: string, end: string) =>
  `${formatTimeValue(start, false)} - ${formatTimeValue(end, true)}`;
