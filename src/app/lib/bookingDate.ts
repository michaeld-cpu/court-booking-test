import { addDays, isSameDay } from 'date-fns'
import { minRemainingHoursBeforeNextDayFetch } from './config'

export const isWithinRemainingHoursBeforeMidnight = (now = new Date()) => {
  const remainingHours = 24 - now.getHours()
  return remainingHours <= minRemainingHoursBeforeNextDayFetch
}

export const shouldShiftBookingDateToNextDay = (
  selectedDate: Date,
  now = new Date(),
) =>
  isWithinRemainingHoursBeforeMidnight(now) && isSameDay(selectedDate, now)

export const getMinimumBookableDate = (now = new Date()) =>
  isWithinRemainingHoursBeforeMidnight(now) ? addDays(now, 1) : now
