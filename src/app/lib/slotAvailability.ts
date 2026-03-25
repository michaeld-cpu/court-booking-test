import { TimeSlot } from '../types';
import { formatTimeValue } from './timeFormat';

const getBooleanValue = (value: unknown, defaultValue: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return defaultValue;
};

const resolveSlotTimeLabel = (rawTime: unknown, index: number) => {
  const raw = String(rawTime ?? '').trim();
  if (!raw) return `Slot ${index + 1}`;
  return formatTimeValue(raw, true) || `Slot ${index + 1}`;
};

export const mapAvailabilitySlots = (
  slots: unknown,
  fallbackPrice = 0,
): TimeSlot[] => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  return slots.map((slot: any, index) => {
    const rawTime =
      slot?.time ??
      slot?.start_time ??
      slot?.startTime ??
      slot?.start ??
      slot?.starts_at ??
      slot?.start_at ??
      slot?.from;
    const rawPrice =
      slot?.price ??
      slot?.amount ??
      slot?.rate ??
      slot?.cost ??
      slot?.hourly_rate ??
      fallbackPrice;
    const priceValue = Number(rawPrice);
    return {
      id: String(slot?.id ?? slot?.slot_id ?? `slot-${index}`),
      time: resolveSlotTimeLabel(rawTime, index),
      available: getBooleanValue(
        slot?.is_available ?? slot?.available,
        true,
      ),
      price: Number.isFinite(priceValue) ? priceValue : Number(fallbackPrice) || 0,
    };
  });
};
