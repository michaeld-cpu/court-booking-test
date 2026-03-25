const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return parsed
}

const parseBoundedInt = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  if (parsed < min || parsed > max) {
    return fallback
  }
  return parsed
}

export const maxSlotSelection = parsePositiveInt(
  import.meta.env.VITE_MAX_SLOT_SELECTION,
  8,
)

export const minRemainingHoursBeforeNextDayFetch = parseBoundedInt(
  import.meta.env.VITE_MIN_REMAINING_HOURS_BEFORE_NEXT_DAY_FETCH,
  3,
  0,
  23,
)

export const bookingSummaryToggleMinSlots = parsePositiveInt(
  import.meta.env.VITE_BOOKING_SUMMARY_TOGGLE_MIN_SLOTS,
  1,
)
