import { Calendar, ChevronDown, Loader2, ShoppingCart, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Court, TimeSlot } from '../types'
import { format } from 'date-fns'
import { DynamicClock } from './DynamicClock'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { isAxiosError } from 'axios'
import { toast } from '@/app/lib/toast'
import { useNavigate } from 'react-router-dom'
import { courtTypeColors } from '../lib/courtTypeColors'
import { formatCurrency } from '../lib/formatCurrency'
import { formatTimeRangeLabel, formatTimeValue } from '../lib/timeFormat'
import { useBottomScrollShadow } from '../hooks/useBottomScrollShadow'
import { bookingSummaryToggleMinSlots } from '../lib/config'

interface TimeRange {
  startSlot: TimeSlot
  endSlot: TimeSlot
  label: string
  price: number
}

interface BookingItem {
  court: Court
  date: string | Date
  ranges: TimeRange[]
  totalPrice: number
  totalHours: number
}

interface BookingSummaryModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  onPayNow?: () => void
  // Single court mode props
  court?: Court
  date?: Date
  timeRanges?: TimeRange[]
  totalPrice?: number
  // Multi-court mode props
  bookingsByCourtAndDate?: BookingItem[]
  grandTotalPrice?: number
  grandTotalHours?: number
  // Optional: Show "Add to Cart" button
  showAddToCart?: boolean
}

interface PaymentOutlet {
  id: string
  name: string
  iconUrl1?: string | null
  iconUrl2?: string | null
}

export function BookingSummaryModal({
  isOpen,
  onClose,
  onConfirm,
  onPayNow,
  court,
  date,
  timeRanges,
  totalPrice,
  bookingsByCourtAndDate,
  grandTotalPrice,
  grandTotalHours,
  showAddToCart,
}: BookingSummaryModalProps) {
  const navigate = useNavigate()
  const { user, mobileNumber } = useAuth()
  // Determine if this is multi-court mode
  const isMultiCourtMode =
    !!bookingsByCourtAndDate && bookingsByCourtAndDate.length > 0

  // For single court mode, convert to array format
  const bookingItems: BookingItem[] = isMultiCourtMode
    ? bookingsByCourtAndDate
    : court && date && timeRanges
      ? [
          {
            court,
            date,
            ranges: timeRanges,
            totalPrice: totalPrice || 0,
            totalHours: timeRanges.length,
          },
        ]
      : []

  const combinedBookingItems = useMemo(() => {
    const grouped = new Map<string, BookingItem>()
    const getRangeKey = (range: TimeRange) => {
      const start = String(range.startSlot?.time ?? '').trim()
      const end = String(range.endSlot?.time ?? '').trim()
      const label = String(range.label ?? '').trim()
      return `${start}__${end}__${label}`
    }

    bookingItems.forEach((item) => {
      const dateValue =
        typeof item.date === 'string'
          ? item.date
          : format(item.date, 'yyyy-MM-dd')
      const key = `${item.court.id}__${dateValue}`
      const existing = grouped.get(key)

      if (!existing) {
        grouped.set(key, {
          ...item,
          ranges: [...item.ranges],
        })
        return
      }

      const existingRangeIds = new Set(
        existing.ranges.map((range) => getRangeKey(range)),
      )
      item.ranges.forEach((range) => {
        const rangeId = getRangeKey(range)
        if (!existingRangeIds.has(rangeId)) {
          existing.ranges.push(range)
          existingRangeIds.add(rangeId)
        }
      })
    })

    return Array.from(grouped.values()).map((item) => {
      const sortedRanges = [...item.ranges].sort((a, b) => {
        const aNum = Number(a.startSlot.id)
        const bNum = Number(b.startSlot.id)
        if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
          return aNum - bNum
        }
        return String(a.startSlot.id).localeCompare(String(b.startSlot.id))
      })

      return {
        ...item,
        ranges: sortedRanges,
        totalHours: sortedRanges.length,
        totalPrice: sortedRanges.reduce((sum, range) => sum + range.price, 0),
      }
    })
  }, [bookingItems])

  const bookingGroups = useMemo(
    () =>
      combinedBookingItems.map((item, index) => {
        const dateKey =
          typeof item.date === 'string'
            ? item.date
            : format(item.date, 'yyyy-MM-dd')
        return {
          ...item,
          groupKey: `${item.court.id}-${dateKey}-${index}`,
        }
      }),
    [combinedBookingItems],
  )
  const [guestName, setGuestName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [userNotes, setUserNotes] = useState('')
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [redirectCountdown, setRedirectCountdown] = useState(5)
  const [paymentOutlets, setPaymentOutlets] = useState<PaymentOutlet[]>([])
  const [isLoadingPaymentOutlets, setIsLoadingPaymentOutlets] = useState(false)
  const [selectedPaymentOutletId, setSelectedPaymentOutletId] = useState<
    string | null
  >(null)
  const [removedBookingGroupKeys, setRemovedBookingGroupKeys] = useState<
    Set<string>
  >(new Set())
  const [expandedSlotGroups, setExpandedSlotGroups] = useState<Set<string>>(
    new Set(),
  )
  const visibleBookingGroups = useMemo(
    () =>
      bookingGroups.filter(
        (item) => !removedBookingGroupKeys.has(item.groupKey),
      ),
    [bookingGroups, removedBookingGroupKeys],
  )
  // Calculate totals
  const finalTotalPrice = visibleBookingGroups.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  )
  const finalTotalHours = visibleBookingGroups.reduce(
    (sum, item) => sum + item.totalHours,
    0,
  )
  const summaryScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const subtleInsetFieldClass =
    '[box-shadow:inset_0_1px_2px_rgba(15,23,42,0.08)]'
  const bookingCardClass = 'overflow-hidden rounded-lg bg-white'
  const slotsListClass = 'space-y-1 bg-gray-50 px-4 py-3'
  const paymentOutletsCacheKey = 'courtbook_payment_outlets'

  const readPaymentOutletsCache = useCallback((): PaymentOutlet[] => {
    if (typeof window === 'undefined') {
      return []
    }
    try {
      const stored = sessionStorage.getItem(paymentOutletsCacheKey)
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? (parsed as PaymentOutlet[]) : []
    } catch {
      return []
    }
  }, [])

  const writePaymentOutletsCache = useCallback((items: PaymentOutlet[]) => {
    if (typeof window === 'undefined' || items.length === 0) {
      return
    }
    try {
      sessionStorage.setItem(paymentOutletsCacheKey, JSON.stringify(items))
    } catch {
      // Ignore cache write failures.
    }
  }, [])

  const normalizePaymentOutlets = useCallback((payload: any): PaymentOutlet[] => {
    if (Array.isArray(payload?.data?.outlets)) {
      return payload.data.outlets
        .map((item: any) => ({
          id: String(item?.id ?? item?.code ?? '').trim(),
          name: String(item?.name ?? item?.label ?? '').trim(),
          iconUrl1: item?.icon_url_1 ?? item?.iconUrl1 ?? null,
          iconUrl2: item?.icon_url_2 ?? item?.iconUrl2 ?? null,
        }))
        .filter((item: PaymentOutlet) => Boolean(item.id && item.name))
    }
    if (Array.isArray(payload?.data?.data)) {
      return payload.data.data
        .map((item: any) => ({
          id: String(item?.id ?? item?.code ?? '').trim(),
          name: String(item?.name ?? item?.label ?? '').trim(),
          iconUrl1: item?.icon_url_1 ?? item?.iconUrl1 ?? null,
          iconUrl2: item?.icon_url_2 ?? item?.iconUrl2 ?? null,
        }))
        .filter((item: PaymentOutlet) => Boolean(item.id && item.name))
    }
    if (Array.isArray(payload?.outlets)) {
      return payload.outlets
        .map((item: any) => ({
          id: String(item?.id ?? item?.code ?? '').trim(),
          name: String(item?.name ?? item?.label ?? '').trim(),
          iconUrl1: item?.icon_url_1 ?? item?.iconUrl1 ?? null,
          iconUrl2: item?.icon_url_2 ?? item?.iconUrl2 ?? null,
        }))
        .filter((item: PaymentOutlet) => Boolean(item.id && item.name))
    }
    if (Array.isArray(payload?.data)) {
      return payload.data
        .map((item: any) => ({
          id: String(item?.id ?? item?.code ?? '').trim(),
          name: String(item?.name ?? item?.label ?? '').trim(),
          iconUrl1: item?.icon_url_1 ?? item?.iconUrl1 ?? null,
          iconUrl2: item?.icon_url_2 ?? item?.iconUrl2 ?? null,
        }))
        .filter((item: PaymentOutlet) => Boolean(item.id && item.name))
    }
    if (Array.isArray(payload)) {
      return payload
        .map((item: any) => ({
          id: String(item?.id ?? item?.code ?? '').trim(),
          name: String(item?.name ?? item?.label ?? '').trim(),
          iconUrl1: item?.icon_url_1 ?? item?.iconUrl1 ?? null,
          iconUrl2: item?.icon_url_2 ?? item?.iconUrl2 ?? null,
        }))
        .filter((item: PaymentOutlet) => Boolean(item.id && item.name))
    }
    return []
  }, [])

  const getCachedBookingId = useCallback((): number | null => {
    if (typeof window === 'undefined') {
      return null
    }
    try {
      const raw = localStorage.getItem('courtbook_latest_booking')
      const parsed = raw ? JSON.parse(raw) : null
      const candidate =
        parsed?.id ??
        parsed?.booking_id ??
        parsed?.payment?.booking_id ??
        null
      const bookingId = Number(candidate)
      return Number.isFinite(bookingId) ? bookingId : null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setGuestName(user?.name ?? '')
    setContactNumber(mobileNumber ?? '')
    setUserNotes('')
    setBookingError(null)
    setShowGuestForm(false)
    setRemovedBookingGroupKeys(new Set())
    setExpandedSlotGroups(new Set())
  }, [isOpen, user?.name, mobileNumber])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const cached = readPaymentOutletsCache()
    if (cached.length > 0) {
      setPaymentOutlets(cached)
      setSelectedPaymentOutletId((prev) =>
        prev && cached.some((item) => item.id === prev) ? prev : cached[0].id,
      )
    }

    let isActive = true
    const loadPaymentOutlets = async () => {
      try {
        if (cached.length === 0) {
          setIsLoadingPaymentOutlets(true)
        }
        const bookingId = getCachedBookingId()
        const response = await api.get('/api/payment-outlets', {
          params: bookingId ? { booking_id: bookingId } : undefined,
        })
        const mapped = normalizePaymentOutlets(response.data)
        if (!isActive || mapped.length === 0) {
          return
        }
        setPaymentOutlets(mapped)
        setSelectedPaymentOutletId((prev) =>
          prev && mapped.some((item) => item.id === prev) ? prev : mapped[0].id,
        )
        writePaymentOutletsCache(mapped)
      } catch {
        // Ignore payment outlet refresh failures; cached data (if any) stays visible.
      } finally {
        if (isActive) {
          setIsLoadingPaymentOutlets(false)
        }
      }
    }

    loadPaymentOutlets()
    return () => {
      isActive = false
    }
  }, [
    isOpen,
    getCachedBookingId,
    normalizePaymentOutlets,
    readPaymentOutletsCache,
    writePaymentOutletsCache,
  ])

  useEffect(() => {
    if (!paymentLink) {
      return
    }

    setRedirectCountdown(5)
    const intervalId = window.setInterval(() => {
      setRedirectCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    const timeoutId = window.setTimeout(() => {
      window.location.href = paymentLink
    }, 4500)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [paymentLink])

  const showBottomInnerShadow = useBottomScrollShadow(
    summaryScrollContainerRef,
    {
      enabled: isOpen,
      deps: [visibleBookingGroups.length, Boolean(bookingError)],
    },
  )

  const parseNumericSlotId = (value: string | number) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    const raw = String(value ?? '').trim()
    if (!raw) {
      return null
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
      return parsed
    }
    const match = raw.match(/\d+/)
    if (!match) {
      return null
    }
    const extracted = Number(match[0])
    return Number.isFinite(extracted) ? extracted : null
  }

  const findSlotIndexByIdOrTime = (slots: TimeSlot[], target: TimeSlot) => {
    const idMatch = slots.findIndex(
      (slot) => String(slot.id) === String(target.id),
    )
    if (idMatch >= 0) {
      return idMatch
    }
    const targetTime = formatTimeValue(target.time, true).toLowerCase()
    return slots.findIndex(
      (slot) => formatTimeValue(slot.time, true).toLowerCase() === targetTime,
    )
  }

  const resolveRangeSlotIds = (item: BookingItem, range: TimeRange) => {
    const availableSlots = item.court.availableSlots ?? []
    const startIndex = findSlotIndexByIdOrTime(availableSlots, range.startSlot)
    const endIndex = findSlotIndexByIdOrTime(availableSlots, range.endSlot)

    if (startIndex >= 0 && endIndex > startIndex) {
      return availableSlots
        .slice(startIndex, endIndex)
        .map((slot) => parseNumericSlotId(slot.id))
        .filter((id): id is number => id !== null)
    }

    const fallbackStartId = parseNumericSlotId(range.startSlot.id)
    return fallbackStartId !== null ? [fallbackStartId] : []
  }

  const venueId = useMemo(() => {
    const firstCourt = visibleBookingGroups[0]?.court
    const operatorId = firstCourt?.operatorId
    if (!operatorId) {
      return undefined
    }
    if (operatorId.startsWith('venue-')) {
      return operatorId.replace('venue-', '')
    }
    const numericMatch = operatorId.match(/(\d+)/)
    return numericMatch ? numericMatch[1] : operatorId
  }, [visibleBookingGroups])

  const handleConfirmBooking = () => {
    if (onConfirm) {
      onConfirm()
      onClose()
    }
  }

  const handlePayNow = async () => {
    // if (!venueId) {
    //   setBookingError('Missing venue information.');
    //   toast.error('Unable to submit booking', {
    //     description: 'Missing venue information.',
    //   });
    //   return;
    // }
    const selectedRangeCount = visibleBookingGroups.reduce(
      (total, item) => total + item.ranges.length,
      0,
    )
    if (selectedRangeCount === 0) {
      setBookingError('Please select at least one time slot.')
      toast.error('No slots selected', {
        description: 'Please select at least one time slot.',
      })
      return
    }

    const resolvedSlotIds = visibleBookingGroups.flatMap((item) =>
      item.ranges.flatMap((range) => resolveRangeSlotIds(item, range)),
    )

    if (resolvedSlotIds.length === 0) {
      setBookingError(
        'Unable to map selected slots. Please reselect your timeslots.',
      )
      toast.error('Unable to submit booking', {
        description:
          'Unable to map selected slots. Please reselect your timeslots.',
      })
      return
    }
    if (paymentOutlets.length > 0 && !selectedPaymentOutletId) {
      setBookingError('Please select a payment option.')
      toast.error('Payment option required', {
        description: 'Please select a payment option.',
      })
      return
    }

    setIsSubmitting(true)
    setBookingError(null)

    const payload = {
      slots: resolvedSlotIds,
      venue_id: Number(venueId),
      user_notes: userNotes.trim(),
      guest_name: guestName.trim(),
      contact_number: contactNumber.trim(),
      player_id: user?.id,
      with_payment: true,
      ...(selectedPaymentOutletId
        ? { payment_outlet: selectedPaymentOutletId }
        : {}),
    }
    try {
      const response = await api.post('/api/bookings', payload)

      const booking = response.data
      const link = booking?.payment?.payment_link ?? null
      if (!link) {
        throw new Error('No payment link was returned. Please try again.')
      }

      localStorage.setItem('courtbook_latest_booking', JSON.stringify(booking))
      setPaymentLink(link)

      if (onPayNow) {
        onPayNow()
      }
      onClose()
    } catch (error) {
      const errorMessage = isAxiosError(error)
        ? (error.response?.data?.message ?? 'Please try again in a moment.')
        : error instanceof Error
          ? error.message
          : 'Please try again in a moment.'
      setBookingError(errorMessage)
      toast.error('Unable to submit booking', {
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-full w-full h-[100dvh] max-h-[100dvh] rounded-none overflow-hidden p-4 pb-[env(safe-area-inset-bottom)] sm:p-5 sm:pb-0 flex flex-col bg-[#f3f4f6] sm:max-h-[90vh] sm:h-auto sm:w-full sm:max-w-lg sm:rounded-lg"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="pb-0 pl-1">
            <DialogTitle
              className="text-xl"
              style={{ fontFamily: 'Alegreya Sans, sans-serif', letterSpacing: '0.02em' }}
            >
              Booking Summary
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 -mt-1">
              Please review your booking details below.
            </DialogDescription>
            {bookingError && (
              <div className="mt-2 mb-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {bookingError}
              </div>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-6 pb-2 px-0.5">
            <div className="bg-transparent p-0">
              {/* <h3 className="mb-3 text-base font-semibold text-gray-900">Venue</h3> */}
              <div className="space-y-4">
              {visibleBookingGroups.map(({ court, date, ranges, groupKey }) => {
                return (
                  <div
                    key={groupKey}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {/* Court Header */}
                    <div className="bg-white px-4 py-4 border-b border-gray-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="font-semibold text-sm text-gray-900">
                            {court.operatorName} -{' '}
                            {(court.purpose ?? 'Others')
                              .charAt(0)
                              .toUpperCase() +
                              (court.purpose ?? 'Others').slice(1)}{' '}
                            {court.name}
                          </strong>
                          <div className="mt-2 flex items-center gap-2">
                            <Calendar className="size-4 text-slate-500" />
                            <p className="text-xs text-slate-600">
                              {format(
                                typeof date === 'string'
                                  ? new Date(date)
                                  : date,
                                'EEE, MMM dd, yyyy',
                              )}
                            </p>
                          </div>
                        </div>
                        {visibleBookingGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setRemovedBookingGroupKeys((prev) => {
                                const next = new Set(prev)
                                next.add(groupKey)
                                return next
                              })
                            }}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-gray-500 hover:text-gray-700 -mr-1"
                            aria-label="Remove booking group"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div className="space-y-1 bg-white px-4 py-3">
                      {ranges.length > bookingSummaryToggleMinSlots ? (
                        <>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between py-1 text-left"
                            onClick={() => {
                              setExpandedSlotGroups((prev) => {
                                const next = new Set(prev)
                                if (next.has(groupKey)) {
                                  next.delete(groupKey)
                                } else {
                                  next.add(groupKey)
                                }
                                return next
                              })
                            }}
                            aria-label={
                              expandedSlotGroups.has(groupKey)
                                ? 'Hide all slots'
                                : 'Show all slots'
                            }
                          >
                            <div className="flex items-center gap-1.5 text-sm">
                              <DynamicClock
                                time={formatTimeValue(
                                  ranges[0].startSlot.time,
                                  true,
                                )}
                                className="size-4 flex-shrink-0"
                              />
                              <span className="text-sm font-semibold text-gray-900">
                                {formatTimeRangeLabel(
                                  ranges[0].startSlot.time,
                                  ranges[ranges.length - 1].endSlot.time,
                                )}
                              </span>
                              {/* <span className="text-[11px] text-slate-600">
                                · {ranges.length} hours
                              </span> */}
                            </div>
                            <div className="inline-flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                ₱
                                {formatCurrency(
                                  ranges.reduce(
                                    (sum, range) => sum + range.price,
                                    0,
                                  ),
                                )}
                              </span>
                              <ChevronDown
                                className={`size-4 text-gray-500 transition-transform ${
                                  expandedSlotGroups.has(groupKey)
                                    ? 'rotate-180'
                                    : ''
                                }`}
                              />
                            </div>
                          </button>
                          {expandedSlotGroups.has(groupKey) &&
                            ranges.map((range, rangeIndex) => (
                              <div
                                key={rangeIndex}
                                className="flex items-center justify-between py-1 pl-4.5"
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <DynamicClock
                                    time={formatTimeValue(
                                      range.startSlot.time,
                                      true,
                                    )}
                                    className="size-4 flex-shrink-0"
                                  />
                                  <span>
                                    {formatTimeRangeLabel(
                                      range.startSlot.time,
                                      range.endSlot.time,
                                    )}
                                  </span>
                                </div>
                                <span className="text-sm">
                                  ₱{formatCurrency(range.price)}
                                </span>
                              </div>
                            ))}
                        </>
                      ) : (
                        ranges.map((range, rangeIndex) => (
                          <div
                            key={rangeIndex}
                            className="flex items-center justify-between py-1"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <DynamicClock
                                time={formatTimeValue(range.startSlot.time, true)}
                                className="size-5 flex-shrink-0"
                              />
                              <span>
                                {formatTimeRangeLabel(
                                  range.startSlot.time,
                                  range.endSlot.time,
                                )}
                              </span>
                            </div>
                            <span className="text-sm">
                              ₱{formatCurrency(range.price)}
                            </span>
                          </div>
                        ))
                      )}

                      {/* Subtotal removed */}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>

            {(isLoadingPaymentOutlets || paymentOutlets.length > 0) && (
              <div className="space-y-3 px-0.5">
                <p className="text-base font-semibold text-slate-700">
                  Payment Method
                </p>
                {isLoadingPaymentOutlets && paymentOutlets.length === 0 ? (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`payment-method-skeleton-${index}`}
                        className={`flex items-center justify-between px-4 py-3 ${
                          index < 2 ? 'border-b border-gray-200' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-6 rounded-full bg-gray-200 animate-pulse" />
                          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                        </div>
                        <div className="h-6 w-16 rounded bg-gray-200 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {paymentOutlets.map((outlet, index) => {
                      const isSelected = selectedPaymentOutletId === outlet.id
                      return (
                        <button
                          key={outlet.id}
                          type="button"
                          onClick={() => setSelectedPaymentOutletId(outlet.id)}
                          aria-pressed={isSelected}
                          className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                            index < paymentOutlets.length - 1
                              ? 'border-b border-gray-200'
                              : ''
                          } ${
                            isSelected
                              ? 'bg-blue-50'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 -ml-1">
                            <span
                              className={`size-6 rounded-full border ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_4px_#eff6ff]'
                                  : 'border-slate-400 bg-white'
                              }`}
                            />
                            <span className="text-sm font-medium text-slate-900">
                              {outlet.name}
                            </span>
                          </div>
                          <span className="flex items-center gap-1.5">
                            {outlet.iconUrl1 && (
                              <img
                                src={outlet.iconUrl1}
                                alt=""
                                className="h-5 w-auto object-contain"
                                loading="lazy"
                              />
                            )}
                            {outlet.iconUrl2 && (
                              <img
                                src={outlet.iconUrl2}
                                alt=""
                                className="h-5 w-auto object-contain"
                                loading="lazy"
                              />
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Guest Details */}
            <div className="space-y-3 px-0.5">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-slate-700">Contact</p>
                <button
                  type="button"
                  onClick={() => setShowGuestForm((prev) => !prev)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  {showGuestForm ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                {showGuestForm ? (
                  <div className="space-y-3 p-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <Input
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Guest name"
                        className={`mt-1 h-12 sm:h-14 text-base sm:text-lg border-0 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ${subtleInsetFieldClass}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">Mobile Number</label>
                      <Input
                        value={contactNumber}
                        onChange={(event) => setContactNumber(event.target.value)}
                        placeholder="09XXXXXXXXX"
                        className={`mt-1 h-12 sm:h-14 text-base sm:text-lg border-0 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ${subtleInsetFieldClass}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">
                        Add booking notes
                      </label>
                      <Textarea
                        ref={notesTextareaRef}
                        value={userNotes}
                        onChange={(event) => setUserNotes(event.target.value)}
                       
                        className={`mt-1 min-h-24 text-base border-0 text-slate-700 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors ${subtleInsetFieldClass}`}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-3 text-sm text-slate-900">
                      {guestName?.trim() || 'Guest name'}
                    </div>
                    <div className="border-t border-gray-200 px-4 py-3 text-sm text-slate-600">
                      {contactNumber?.trim() || 'Mobile number'}
                    </div>
                    {userNotes.trim() && (
                      <div className="border-t border-gray-200 px-4 py-3 text-sm text-slate-600">
                        {userNotes.trim()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer with Total and Actions */}
          <div className="sticky z-20 -mt-4 -mx-4 sm:-mx-5  bg-white/150  shadow-[0_-2px_12px_rgba(15,23,42,0.12)]  ">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-mediun font-semibold text-slate-900">
                  Total
                </span>
                <span className="text-mediun font-bold text-slate-900">
                  ₱{formatCurrency(finalTotalPrice)}
                </span>
              </div>
              <div className="p-5 pt-1">
                <Button
                  onClick={handlePayNow}
                  disabled={
                    isSubmitting ||
                    visibleBookingGroups.length === 0 ||
                    (paymentOutlets.length > 0 && !selectedPaymentOutletId)
                  }
                  className=" w-full  hover:brightness-105"
                >
                  {isSubmitting
                    ? 'Submitting...'
                    : visibleBookingGroups.length === 0
                      ? 'No slots selected'
                      : `Pay Now`}
                </Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>
      {(isSubmitting || paymentLink) && (
        <div
          className="fixed inset-0 z-[3000] flex h-screen w-screen items-center justify-center bg-white p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Payment Redirect"
        >
          <div className="sr-only">
            Preparing and redirecting your booking payment.
          </div>
          <div className="flex h-full w-full flex-col items-center justify-center space-y-4 overflow-auto">
            {isSubmitting && !paymentLink && (
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-10 animate-spin text-gray-800" />
                <p className="text-sm text-gray-600">
                  Preparing your payment...
                </p>
              </div>
            )}
            {paymentLink && redirectCountdown > 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-2">
                <div className="relative size-24">
                  <svg
                    className="size-24 -rotate-90"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#111827"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={
                        2 * Math.PI * 42 * (1 - (5 - redirectCountdown) / 5)
                      }
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-900">
                    {redirectCountdown}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Redirecting to the payment gateway in {redirectCountdown}s.
                </p>
              </div>
            )}
            {paymentLink && redirectCountdown === 0 && (
              // <div className="w-full max-w-sm break-all rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-center text-xs mb-4">
              //   <a
              //     href={paymentLink}
              //     target="_blank"
              //     rel="noreferrer"
              //     className="text-blue-600 hover:underline"
              //   >
              //     {paymentLink}
              //   </a>
              // </div>
              <p className="text-sm text-gray-600 mb-4">Please wait...</p>
            )}
            {paymentLink && (
              <Button
                className="w-full max-w-sm"
                onClick={() => {
                  const opened = window.open(paymentLink, '_blank')
                  if (opened) {
                    setPaymentLink(null)
                    navigate('/bookings')
                  }
                }}
              >
                Continue now
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
