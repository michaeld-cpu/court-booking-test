import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Booking } from '../types';
import { Calendar, ChevronDown, Globe, ListFilter, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { isAxiosError } from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { courtTypeColors } from '../lib/courtTypeColors';
import { formatCurrency } from '../lib/formatCurrency';
import { toast } from '@/app/lib/toast';
import { DynamicClock } from '../components/DynamicClock';
import { formatTimeRangeLabel, formatTimeValue } from '../lib/timeFormat';
import { EmptyState } from '../components/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface MyBookingsProps {
  bookings: Booking[];
  onBookingsSync?: (bookings: Booking[]) => void;
}

const PENDING_COUNTDOWN_EXTENSION_MS = 60 * 1000;

// (banner images removed for bookings cards)

export function MyBookings({ bookings, onBookingsSync }: MyBookingsProps) {
  const groupingStorageKey = 'courtbook_mybookings_group_by';
  const bookingsCacheKey = 'courtbook_mybookings_cached_list';
  const getStoredGrouping = (): 'booking_date' | 'status' => {
    if (typeof window === 'undefined') {
      return 'booking_date';
    }
    try {
      const stored = localStorage.getItem(groupingStorageKey);
      return stored === 'status' ? 'status' : 'booking_date';
    } catch {
      return 'booking_date';
    }
  };
  const getCachedBookings = (): Booking[] => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = sessionStorage.getItem(bookingsCacheKey);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? (parsed as Booking[]) : [];
    } catch {
      return [];
    }
  };
  const writeBookingsCache = useCallback((items: Booking[]) => {
    if (typeof window === 'undefined' || items.length === 0) {
      return;
    }
    try {
      sessionStorage.setItem(bookingsCacheKey, JSON.stringify(items));
    } catch {
      // Ignore cache write failures.
    }
  }, []);
  const [remoteBookings, setRemoteBookings] = useState<Booking[]>(getCachedBookings);
  const [hasCompletedInitialFetch, setHasCompletedInitialFetch] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [groupBy, setGroupBy] = useState<'booking_date' | 'status'>(
    getStoredGrouping,
  );
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedBookingCourtSlots, setExpandedBookingCourtSlots] = useState<
    Set<string>
  >(new Set());
  const [calendarMode, setCalendarMode] = useState<'booking' | 'play'>('play');
  const [calendarRange, setCalendarRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | undefined>(
    undefined,
  );
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(
    null,
  );
  const handledExpiredPendingKeysRef = useRef<Set<string>>(new Set());

  const normalizeAddress = (address?: string | null) => {
    if (!address) {
      return '';
    }
    return address
      .replace(/,\s*philippines\b/gi, '')
      .replace(/\s*,\s*$/, '')
      .trim();
  };

  const mapBooking = (item: any): Booking => {
    const venue = item.venue ?? item.operator ?? {};
    const court = item.court ?? {};
    const location = normalizeAddress(item.location ?? venue.address ?? venue.location ?? '');
    const bookingDate = item.created_ts ?? item.date ?? new Date().toISOString();
    return {
      id: String(item.id ?? `${Date.now()}-${Math.random()}`),
      courtId: String(court.id ?? item.court_id ?? 'unknown'),
      courtName: court.name ?? item.court_name ?? item.venue_name ?? 'Court Booking',
      courtType: court.type ?? item.court_type ?? 'basketball',
      status: item.status ?? item.booking_status ?? item.state ?? undefined,
      guestName:
        item.guest_name ??
        item.guestName ??
        item.player?.name ??
        item.user?.name ??
        undefined,
      contactNumber:
        item.contact_number ??
        item.contactNumber ??
        item.player?.mobile_number ??
        item.user?.mobile_number ??
        undefined,
      venueContactNumber:
        item.venue?.contact_number ??
        item.venue?.contactNumber ??
        venue.contact_number ??
        venue.contactNumber ??
        venue.phone ??
        item.venue_contact_number ??
        item.operator_contact_number ??
        undefined,
      venueWebsiteUrl:
        item.venue?.website_url ??
        item.venue?.websiteUrl ??
        venue.website_url ??
        venue.websiteUrl ??
        item.venue_website_url ??
        undefined,
      venueFacebookLink:
        item.venue?.facebook_link ??
        item.venue?.facebookLink ??
        venue.facebook_link ??
        venue.facebookLink ??
        item.venue_facebook_link ??
        undefined,
      image: undefined,
      bookingCourts: Array.isArray(item.bookingCourts) ? item.bookingCourts : [],
      date: bookingDate,
      expiresAfterTs: item.expires_after_ts ?? item.expiresAfterTs ?? undefined,
      timeSlotFrom: item.time_slot_from ?? item.time_from ?? 'TBD',
      timeSlotTo: item.time_slot_to ?? item.time_to ?? 'TBD',
      price: Number(item.total_amount ?? item.price ?? 0),
      operatorId: String(venue.id ?? item.venue_id ?? item.operator_id ?? 'venue'),
      operatorName: venue.name ?? item.venue_name ?? item.operator_name ?? 'Venue',
      location,
      city: item.city ?? venue.city ?? '',
    };
  };

  const fetchBookings = useCallback(async (options?: { background?: boolean; initial?: boolean }) => {
    const isBackground = options?.background === true;
    if (!isBackground) {
      setLoadError(null);
    }
    try {
      const response = await api.get('/api/bookings');
      const payload = response.data;
      const data = Array.isArray(payload?.data?.bookings)
        ? payload.data.bookings
        : Array.isArray(payload?.data?.data)
          ? payload.data.data
        : Array.isArray(payload?.bookings)
          ? payload.bookings
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];
      const mapped = data.map(mapBooking);
      setRemoteBookings(mapped);
      onBookingsSync?.(mapped);
      writeBookingsCache(mapped);
      if (!isBackground) {
        setLoadError(null);
      }
    } catch (error) {
      if (!isBackground) {
        const message = isAxiosError(error)
          ? error.response?.data?.message ?? 'Unable to load bookings.'
          : 'Unable to load bookings.';
        setLoadError(message);
      }
    } finally {
      if (options?.initial) {
        setHasCompletedInitialFetch(true);
      }
    }
  }, [onBookingsSync]);

  useEffect(() => {
    const hasCachedAtStart = getCachedBookings().length > 0;
    fetchBookings({ background: hasCachedAtStart, initial: true });
  }, [fetchBookings]);

  useEffect(() => {
    writeBookingsCache(remoteBookings);
  }, [remoteBookings, writeBookingsCache]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(groupingStorageKey, groupBy);
    } catch {
      // Ignore storage write failures.
    }
  }, [groupBy, groupingStorageKey]);

  const displayBookings = useMemo(
    () => (remoteBookings.length > 0 ? remoteBookings : bookings),
    [remoteBookings, bookings]
  );

  useEffect(() => {
    const activePendingKeys = new Set(
      displayBookings
        .filter((booking) => String(booking.status ?? '').toLowerCase().trim() === 'pending')
        .map((booking) => `${booking.id}-${booking.expiresAfterTs ?? ''}`),
    );

    handledExpiredPendingKeysRef.current.forEach((key) => {
      if (!activePendingKeys.has(key)) {
        handledExpiredPendingKeysRef.current.delete(key);
      }
    });
  }, [displayBookings]);

  useEffect(() => {
    const newlyExpiredPendingKeys = displayBookings
      .filter((booking) => {
        const normalizedStatus = String(booking.status ?? '').toLowerCase().trim();
        if (normalizedStatus !== 'pending' || !booking.expiresAfterTs) {
          return false;
        }
        const expiresAt = new Date(booking.expiresAfterTs).getTime() + PENDING_COUNTDOWN_EXTENSION_MS;
        if (!Number.isFinite(expiresAt) || expiresAt > now) {
          return false;
        }
        const key = `${booking.id}-${booking.expiresAfterTs}`;
        return !handledExpiredPendingKeysRef.current.has(key);
      })
      .map((booking) => `${booking.id}-${booking.expiresAfterTs}`);

    if (newlyExpiredPendingKeys.length === 0) {
      return;
    }

    newlyExpiredPendingKeys.forEach((key) => {
      handledExpiredPendingKeysRef.current.add(key);
    });

    fetchBookings({ background: true });
  }, [displayBookings, now, fetchBookings]);

  const getPlayDatesForBooking = (booking: Booking) => {
    const slotDates = booking.bookingCourts
      ?.flatMap((bookingCourt) => bookingCourt.slots ?? [])
      .map((slot) => slot?.date)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .map((value) => startOfDay(value)) ?? [];

    if (slotDates.length > 0) {
      return slotDates;
    }

    const fallback = new Date(booking.date);
    if (Number.isNaN(fallback.getTime())) {
      return [];
    }
    return [startOfDay(fallback)];
  };

  const getBookingDateForBooking = (booking: Booking) => {
    const value = new Date(booking.date);
    return Number.isNaN(value.getTime()) ? null : startOfDay(value);
  };

  const bookingDateKeysWithBookings = useMemo(() => {
    const keys = new Set<string>();
    displayBookings.forEach((booking) => {
      const bookingDate = getBookingDateForBooking(booking);
      if (bookingDate) {
        keys.add(format(bookingDate, 'yyyy-MM-dd'));
      }
    });
    return keys;
  }, [displayBookings]);

  const playDateKeysWithBookings = useMemo(() => {
    const keys = new Set<string>();
    displayBookings.forEach((booking) => {
      getPlayDatesForBooking(booking).forEach((date) => {
        keys.add(format(date, 'yyyy-MM-dd'));
      });
    });
    return keys;
  }, [displayBookings]);

  const filteredBookings = useMemo(() => {
    if (!calendarRange) {
      return displayBookings;
    }

    return displayBookings.filter((booking) => {
      if (calendarMode === 'booking') {
        const bookingDate = getBookingDateForBooking(booking);
        if (!bookingDate) return false;
        return (
          bookingDate.getTime() >= calendarRange.from.getTime() &&
          bookingDate.getTime() <= calendarRange.to.getTime()
        );
      }

      const playDates = getPlayDatesForBooking(booking);
      return playDates.some(
        (date) =>
          date.getTime() >= calendarRange.from.getTime() &&
          date.getTime() <= calendarRange.to.getTime(),
      );
    });
  }, [displayBookings, calendarMode, calendarRange]);

  useEffect(() => {
    if (filteredBookings.length === 0) {
      setExpandedBookingIds(new Set());
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    setExpandedBookingIds((prev) => {
      const validIds = new Set(filteredBookings.map((booking) => booking.id));
      const next = new Set(
        Array.from(prev).filter((bookingId) => validIds.has(bookingId)),
      );

      filteredBookings.forEach((booking) => {
        const normalizedStatus = String(booking.status ?? '')
          .toLowerCase()
          .trim();
        const bookingDate = new Date(booking.date);
        const bookingDateStart = new Date(bookingDate);
        bookingDateStart.setHours(0, 0, 0, 0);

        if (normalizedStatus === 'expired') {
          next.delete(booking.id);
          return;
        }

        if (
          normalizedStatus === 'confirmed' &&
          !Number.isNaN(bookingDateStart.getTime()) &&
          bookingDateStart >= todayStart
        ) {
          next.add(booking.id);
        }
      });

      return next;
    });
  }, [filteredBookings]);

  const getPaymentLinkForBooking = (bookingId: string) => {
    try {
      const stored = localStorage.getItem('courtbook_latest_booking');
      const parsed = stored ? JSON.parse(stored) : null;
      const payment = parsed?.payment ?? null;
      const paymentLink = payment?.payment_link ?? null;
      const paymentBookingId = Number(payment?.booking_id ?? NaN);
      const targetBookingId = Number(bookingId);

      if (!paymentLink || paymentBookingId !== targetBookingId) {
        return null;
      }

      return paymentLink;
    } catch (error) {
      return null;
    }
  };

  const formatSlotTime = (time?: string) => {
    if (!time) return 'TBD';
    const base = parse(time, 'HH:mm:ss', new Date());
    const minutes = base.getMinutes();
    const rounded = minutes >= 30 ? 60 : 0;
    const roundedDate = new Date(base);
    roundedDate.setMinutes(rounded, 0, 0);
    return formatTimeValue(format(roundedDate, 'HH:mm:ss'), true);
  };

  const toMinutesSinceMidnight = (time?: string) => {
    if (!time) return null;
    const parsed = parse(time, 'HH:mm:ss', new Date());
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.getHours() * 60 + parsed.getMinutes();
  };

  const minutesToTimeString = (minutes: number) => {
    const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalizedMinutes / 60);
    const remainder = normalizedMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}:00`;
  };

  const roundMinutesToNearestHour = (minutes: number) =>
    Math.round(minutes / 60) * 60;

  const getStatusMeta = (booking: Booking) => {
    const normalizedStatus = (booking.status ?? 'pending')
      .toString()
      .toLowerCase();
    const isPending = normalizedStatus === 'pending';
    const isConfirmed = normalizedStatus === 'confirmed';
    const isExpired =
      isPending &&
      !isConfirmed &&
      Boolean(booking.expiresAfterTs) &&
      new Date(booking.expiresAfterTs as string).getTime() + PENDING_COUNTDOWN_EXTENSION_MS < now;
    const statusLabel = (isExpired ? 'expired' : normalizedStatus)
      .toString()
      .replace(/_/g, ' ')
      .toLowerCase();
    return { normalizedStatus, statusLabel };
  };

  const getBookingCalendarDateRange = (booking: Booking) => {
    const allSlots =
      booking.bookingCourts?.flatMap((bookingCourt) => bookingCourt.slots ?? []) ?? [];

    const datedRanges = allSlots
      .map((slot) => {
        if (!slot?.date || !slot?.start_time) {
          return null;
        }
        const start = new Date(`${slot.date}T${slot.start_time}`);
        const end = slot.end_time
          ? new Date(`${slot.date}T${slot.end_time}`)
          : new Date(start.getTime() + 60 * 60 * 1000);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return null;
        }
        return { start, end };
      })
      .filter((range): range is { start: Date; end: Date } => Boolean(range));

    if (datedRanges.length > 0) {
      const start = datedRanges.reduce((min, current) =>
        current.start.getTime() < min.getTime() ? current.start : min
      , datedRanges[0].start);
      const end = datedRanges.reduce((max, current) =>
        current.end.getTime() > max.getTime() ? current.end : max
      , datedRanges[0].end);
      return { start, end };
    }

    const fallbackStart = new Date(booking.date);
    const start = Number.isNaN(fallbackStart.getTime()) ? new Date() : fallbackStart;
    return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
  };

  const formatCalendarTimestamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');

  const getGoogleCalendarLink = (booking: Booking) => {
    const { start, end } = getBookingCalendarDateRange(booking);
    const details = booking.bookingCourts
      ?.map((bookingCourt) => {
        const purpose = bookingCourt.court?.purpose ?? booking.courtType ?? 'court';
        const number = bookingCourt.court?.number ?? bookingCourt.court?.id ?? '';
        return `${purpose} court ${number}`.trim();
      })
      .join(', ');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${booking.operatorName} Booking`,
      dates: `${formatCalendarTimestamp(start)}/${formatCalendarTimestamp(end)}`,
      location: booking.location || booking.operatorName,
      details: details || 'Court booking',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const getCalendarEventDetails = (booking: Booking) => {
    const { start, end } = getBookingCalendarDateRange(booking);
    const courtDetails = booking.bookingCourts
      ?.map((bookingCourt) => {
        const purpose = bookingCourt.court?.purpose ?? booking.courtType ?? 'court';
        const number = bookingCourt.court?.number ?? bookingCourt.court?.id ?? '';
        return `${purpose} court ${number}`.trim();
      })
      .join(', ');
    return {
      title: `${booking.operatorName} Booking`,
      start,
      end,
      location: booking.location || booking.operatorName,
      details: courtDetails || 'Court booking',
    };
  };

  const escapeICS = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const handleAddToCalendar = (booking: Booking) => {
    try {
      const event = getCalendarEventDetails(booking);
      const venueSlug =
        booking.operatorName
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .replace(/-{2,}/g, '-') || 'venue';
      const datePart = format(event.start, 'MMyyyy');
      const uid = `booking-${booking.id}-${event.start.getTime()}@korte`;
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Korte//Court Booking//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatCalendarTimestamp(new Date())}`,
        `DTSTART:${formatCalendarTimestamp(event.start)}`,
        `DTEND:${formatCalendarTimestamp(event.end)}`,
        `SUMMARY:${escapeICS(event.title)}`,
        `DESCRIPTION:${escapeICS(event.details)}`,
        `LOCATION:${escapeICS(event.location)}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${venueSlug}-${datePart}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Calendar event downloaded', {
        description: 'Open the file to add this booking to your calendar.',
      });

      window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch {
      window.open(getGoogleCalendarLink(booking), '_blank', 'noopener,noreferrer');
    }
  };

  const handleShareVenue = async (booking: Booking) => {
    const venueUrl = `${window.location.origin}/operator/${booking.operatorId}`;
    const shareData = {
      title: booking.operatorName,
      text: `Check out ${booking.operatorName}`,
      url: venueUrl,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(venueUrl);
        toast.success('Venue link copied');
        return;
      }
    } catch {
      // ignore and fallback below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = venueUrl;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Venue link copied');
    } catch {
      toast.error('Unable to share venue');
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    const shouldCancel = window.confirm(
      'Cancel this pending booking? This action cannot be undone.',
    );
    if (!shouldCancel) {
      return;
    }

    try {
      setCancellingBookingId(booking.id);
      await api.post(`/api/bookings/${booking.id}/cancel`);
      toast.success('Booking cancelled');
      await fetchBookings({ background: false });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? 'Unable to cancel booking.'
        : 'Unable to cancel booking.';
      toast.error(message);
    } finally {
      setCancellingBookingId(null);
    }
  };

  const groupedBookingSections = useMemo(() => {
    const indexed = filteredBookings.map((booking, index) => ({
      booking,
      index,
      statusLabel: getStatusMeta(booking).statusLabel,
    }));

    if (groupBy === 'booking_date') {
      return [{ key: 'booking_date', label: null, items: indexed }];
    }

    const statusOrder = ['pending', 'confirmed', 'expired', 'cancelled'];
    const sectionMap = new Map<string, typeof indexed>();
    indexed.forEach((item) => {
      const key = item.statusLabel;
      if (!sectionMap.has(key)) {
        sectionMap.set(key, []);
      }
      sectionMap.get(key)?.push(item);
    });

    const orderedKeys = [
      ...statusOrder.filter((status) => sectionMap.has(status)),
      ...Array.from(sectionMap.keys()).filter(
        (status) => !statusOrder.includes(status),
      ),
    ];

    return orderedKeys.map((status) => ({
      key: `status-${status}`,
      label: status.charAt(0).toUpperCase() + status.slice(1),
      items: sectionMap.get(status) ?? [],
    }));
  }, [filteredBookings, groupBy, now]);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) {
      setSelectedCalendarDay(undefined);
      setCalendarRange(null);
      return;
    }
    const day = startOfDay(date);
    setSelectedCalendarDay(day);
    setCalendarRange({ from: day, to: endOfDay(day) });
  };

  const dateKeysWithBookings =
    calendarMode === 'booking'
      ? bookingDateKeysWithBookings
      : playDateKeysWithBookings;
  const calendarGridDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let current = gridStart;
    while (current <= gridEnd) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [calendarMonth]);


  const shouldShowSkeleton =
    !hasCompletedInitialFetch && displayBookings.length === 0;

  if (shouldShowSkeleton) {
    return (
      <div className="pt-0 md:pt-8 pb-0 md:pb-12 min-h-svh">
        <div className="px-6 pr-4 sm:px-0 mb-0 md:mb-3 flex items-center justify-between gap-3 py-4 sm:py-5 md:py-2 lg:py-2 bg-neutral-900 text-white sm:bg-transparent sm:text-inherit">
          <h1
            className="text-xl md:text-2xl font-semibold text-white sm:text-inherit"
            style={{ fontFamily: 'Alegreya Sans, sans-serif', letterSpacing: '0.02em' }}
          >
            Bookings
          </h1>
          <Select
            value={groupBy}
            onValueChange={(value: 'booking_date' | 'status') => setGroupBy(value)}
          >
            <SelectTrigger className="size-10 shrink-0 justify-center rounded-full border border-white/20 bg-transparent p-0 text-white shadow-none [&>svg]:hidden sm:h-9 sm:w-fit sm:min-w-0 sm:justify-end sm:rounded-md sm:border sm:border-border sm:bg-transparent sm:px-3 sm:text-sm sm:text-secondary-foreground sm:hover:bg-secondary/80">
              <span className="inline-flex items-center justify-center sm:hidden">
                <ListFilter className="size-4 text-white/85" />
              </span>
              <span className="hidden items-center justify-end gap-1.5 whitespace-nowrap sm:flex">
                <ListFilter className="mr-1 size-3.5 text-muted-foreground" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="booking_date">
                Booking Date
              </SelectItem>
              <SelectItem value="status">
                Status
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
            <div className="hidden md:block order-2 md:order-1 md:col-span-1 md:sticky md:top-20">
              <div className="rounded-none border border-gray-200 bg-white p-4 shadow-sm sm:rounded-lg">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                  <div className="h-7 w-36 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="h-7 w-40 mx-auto rounded bg-gray-200 animate-pulse mb-2" />
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, dayIndex) => (
                    <div
                      key={`calendar-day-skeleton-${dayIndex}`}
                      className="h-9 rounded bg-gray-200/80 animate-pulse"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2 md:col-span-2 grid grid-cols-1 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card
                  key={`booking-skeleton-${index}`}
                  className="overflow-hidden rounded-none sm:rounded-lg border-0 sm:border flex flex-col gap-0 shadow-sm"
                >
                  <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2">
                    <div className="h-3.5 w-44 rounded bg-gray-200 animate-pulse" />
                    <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
                  </div>
                  <CardContent className="px-5 py-6 flex-1 flex flex-col gap-0">
                    <div className="rounded-t-lg border-b border-dashed border-gray-200 bg-gray-100 px-5 py-4">
                      <div className="h-3 w-20 rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="h-4 w-52 rounded bg-gray-200 animate-pulse" />
                    </div>
                    <div className="border-b border-dashed border-gray-200 bg-gray-50 px-5 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="h-3 w-20 rounded bg-gray-200 animate-pulse mb-2" />
                          <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
                        </div>
                        <div>
                          <div className="h-3 w-24 rounded bg-gray-200 animate-pulse mb-2" />
                          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="rounded-b-lg bg-gray-50 px-4 py-4">
                      <div className="space-y-3">
                        <div className="h-4 w-52 rounded bg-gray-200 animate-pulse" />
                        <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                        <div className="h-4 w-[92%] rounded bg-gray-200 animate-pulse" />
                        <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                          <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
                          <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-10 w-full rounded-md bg-gray-200 animate-pulse" />
                  </CardContent>
                  <div className="px-5 pb-4">
                    <div className="h-9 w-full rounded-md bg-gray-200 animate-pulse" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && displayBookings.length === 0) {
    return (
      <div className="pt-6 md:pt-8 pb-0 md:pb-12">
        <h1 className="text-xl md:text-2xl font-bold mb-5 md:mb-8">Bookings</h1>
        <div className="text-red-600">{loadError}</div>
      </div>
    );
  }

  if (displayBookings.length === 0) {
    return (
      <EmptyState
        icon={
          <div className="rounded-full bg-emerald-100 p-4">
            <Calendar className="size-8 text-emerald-600" />
          </div>
        }
        title="No bookings yet"
        description={
          <>
            Your bookings will appear here <br />after you complete a payment.
          </>
        }
        action={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">Browse Courts</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="pt-0 md:pt-4 pb-0 md:pb-8 min-h-svh">
      <div className="mb-0 md:mb-3 flex items-center justify-between gap-3 bg-neutral-900 px-6 pr-4 py-4 text-white sm:bg-transparent sm:px-0 sm:py-5 sm:text-inherit md:py-2 lg:py-2">
        <h1
          className="text-xl md:text-2xl font-semibold text-white sm:text-inherit"
          style={{ fontFamily: 'Alegreya Sans, sans-serif', letterSpacing: '0.02em' }}
        >
          Bookings
        </h1>
        <Select
          value={groupBy}
          onValueChange={(value: 'booking_date' | 'status') => setGroupBy(value)}
        >
          <SelectTrigger className="size-10 shrink-0 justify-center rounded-full border border-white/20 bg-transparent p-0 text-white shadow-none [&>svg]:hidden sm:h-9 sm:w-fit sm:min-w-0 sm:justify-end sm:rounded-md sm:border sm:border-border sm:bg-transparent sm:px-3 sm:text-sm sm:text-secondary-foreground sm:hover:bg-secondary/80">
            <span className="inline-flex items-center justify-center sm:hidden">
              <ListFilter className="size-4 text-white/85" />
            </span>
            <span className="hidden items-center justify-end gap-1.5 whitespace-nowrap sm:flex">
              <ListFilter className="mr-1 size-3.5 text-muted-foreground" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="booking_date">
              Booking Date
            </SelectItem>
            <SelectItem value="status">
              Status
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mx-auto w-full max-w-[1300px] px-0 sm:px-0 md:px-0">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
          <aside className="hidden md:block order-2 md:order-1 md:col-span-1 md:sticky md:top-20">
            <div className="rounded-none border border-gray-200 bg-white p-4 shadow-sm sm:rounded-lg">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Calendar</p>
                <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      calendarMode === 'booking'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500'
                    }`}
                    onClick={() => setCalendarMode('booking')}
                  >
                    Booking Date
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      calendarMode === 'play'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500'
                    }`}
                    onClick={() => setCalendarMode('play')}
                  >
                    Play Date
                  </button>
                </div>
              </div>
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, -1))}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <p className="text-sm font-semibold text-gray-900">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-500">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
                    <div key={label} className="py-1">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {calendarGridDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const hasBooking = dateKeysWithBookings.has(key);
                    const isOutsideMonth = !isSameMonth(day, calendarMonth);
                    const isSelected =
                      selectedCalendarDay && isSameDay(day, selectedCalendarDay);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCalendarSelect(day)}
                        className={`relative inline-flex h-9 items-center justify-center rounded-md text-sm transition-colors ${
                          isSelected
                            ? 'bg-gray-900 text-white'
                            : isOutsideMonth
                              ? 'text-gray-300 hover:bg-gray-50'
                              : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {format(day, 'd')}
                        {hasBooking && (
                          <span
                            className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-blue-500'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

      <div
        className={`order-1 md:order-2 md:col-span-2 mx-auto grid w-full grid-cols-1 gap-3 md:gap-4 ${
          groupBy === 'status' ? 'mt-3 md:mt-0' : ''
        }`}
      >
        {groupedBookingSections.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No bookings found for the selected date filter.
          </div>
        )}
        {groupedBookingSections.map((section) => (
          <React.Fragment key={section.key}>
            {section.label && (
              <p className="px-5 md:px-0 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                {section.label}
              </p>
            )}
            {section.items.map(({ booking, index }) => {
          const bookingDate = new Date(booking.date)
          const { normalizedStatus, statusLabel } = getStatusMeta(booking)
          const statusText =
            statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)
          const statusStyles: Record<string, string> = {
            pending:
              'bg-amber-500/20 text-amber-700 border-amber-500/30',
            confirmed:
              'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
            expired: 'bg-gray-100 text-gray-500 border-gray-200',
            cancelled: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
            failed: 'bg-red-500/20 text-red-700 border-red-500/30',
          }
          const bookingCourts = booking.bookingCourts ?? []
          const courtCount = bookingCourts.length > 0 ? bookingCourts.length : 1
          const slotCount =
            bookingCourts.length > 0
              ? bookingCourts.reduce((total, bookingCourt) => {
                  if (typeof bookingCourt.slot_count === 'number') {
                    return total + bookingCourt.slot_count
                  }
                  return total + (bookingCourt.slots?.length ?? 0)
                }, 0)
              : 1
          const remainingMs = booking.expiresAfterTs
            ? new Date(booking.expiresAfterTs as string).getTime() +
              PENDING_COUNTDOWN_EXTENSION_MS -
              now
            : null
          const remainingSeconds = remainingMs
            ? Math.max(0, Math.floor(remainingMs / 1000))
            : 0
          const venuePhone = String(booking.venueContactNumber ?? '').trim()
          const venueWebsiteUrl = String(booking.venueWebsiteUrl ?? '').trim()
          const venueFacebookLink = String(booking.venueFacebookLink ?? '').trim()
          const venueLinkUrl =
            venueWebsiteUrl && venueWebsiteUrl.toLowerCase() !== 'null'
              ? venueWebsiteUrl
              : venueFacebookLink && venueFacebookLink.toLowerCase() !== 'null'
                ? venueFacebookLink
                : ''
          const countdown =
            remainingMs && remainingMs > 0
              ? `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`
              : null
          const isPending = statusLabel === 'pending'
          const continuePaymentLink = getPaymentLinkForBooking(booking.id)
          const bookingHasPassed = getBookingCalendarDateRange(booking).end.getTime() <= now

          return (
            <Card
              key={booking.id}
              className={`overflow-hidden rounded-none sm:rounded-lg border-0 sm:border flex flex-col gap-0 transition-shadow  bg-white ${
                index === displayBookings.length - 1
                  ? 'shadow-sm hover:shadow-md mb-3 sm:mb-6'
                  : 'shadow-sm hover:shadow-md'
              }`}
            >
              <div className="mx-5 mt-5.5 flex items-center justify-between gap-2 text-xs -mb-1 ">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="size-3.5 flex-shrink-0" />
                  Booking Date:
                  <span className="capitalize">
                    {format(bookingDate, 'MMM d, yyyy h:mma').toLowerCase()}
                  </span>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-[8px] py-[2px] text-[11px] font-semibold whitespace-nowrap ${statusStyles[statusLabel] ?? 'bg-gray-900 text-white'}`}
                >
                  {statusText}
                </div>
              </div>

              <div className="grid transition-all duration-300 ease-in-out grid-rows-[1fr] opacity-100 pointer-events-auto ">
                <div className="overflow-hidden">
                  <CardContent className="px-5 sm:px-5 py-6 sm:py-6 md:py-6 flex-1 flex flex-col gap-0 transition-[padding] duration-300 ">
                    <div className="rounded-lg border border-gray-200 bg-gray-50">
                      <div className="rounded-t-lg border-b border-gray-200 px-5 py-4">
                        <div className="grid grid-cols-1 gap-3 text-sm ">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1">
                                Venue
                              </p>
                              <Link
                                to={`/operator/${booking.operatorId}`}
                                className="truncate font-medium leading-none text-gray-800 hover:text-gray-900"
                              >
                                {booking.operatorName}
                              </Link>
                            </div>
                            {venuePhone &&
                            venuePhone.toLowerCase() !== 'null' ? (
                              <a
                                href={`tel:${venuePhone}`}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full  bg-white/50 text-gray-700 hover:bg-gray-50 -mr-1"
                                aria-label={`Call ${booking.operatorName}`}
                                title={`Call ${booking.operatorName}`}
                              >
                                <Phone className="size-3.5" />
                              </a>
                            ) : venueLinkUrl ? (
                              <a
                                href={venueLinkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/50 text-gray-700 hover:bg-gray-50 -mr-1"
                                aria-label={`Open ${booking.operatorName} link`}
                                title={`Open ${booking.operatorName} link`}
                              >
                                <Globe className="size-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className=" border-b border-dashed border-gray-200 bg-gray-50 px-5 py-4">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1">
                              Guest Name
                            </p>
                            <p className="truncate font-medium text-gray-800">
                              {booking.guestName?.trim() || 'N/A'}
                            </p>
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500 mb-1">
                              Contact Number
                            </p>
                            <p className="truncate font-medium text-gray-800">
                              {booking.contactNumber?.trim() || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-b-lg bg-gray-50 px-5 py-4">
                        <div className="grid w-full gap-3">
                          {booking.bookingCourts &&
                            booking.bookingCourts.length > 0 && (
                              <div className=" border-b border-gray-200">
                                <div className="space-y-3">
                                  {booking.bookingCourts.map((bookingCourt) => {
                                    const purposeLabel =
                                      bookingCourt.court?.purpose ??
                                      bookingCourt.court?.type ??
                                      booking.courtType ??
                                      'others'
                                    const courtNumber =
                                      bookingCourt.court?.number ??
                                      bookingCourt.court?.id ??
                                      'Court'
                                    const slots = bookingCourt.slots ?? []
                                    const hasSlotSummary = slots.length > 0
                                    const courtDateLabel = slots[0]?.date
                                      ? format(
                                          new Date(slots[0].date),
                                          'EEE, MMM dd',
                                        )
                                      : bookingDate.toLocaleDateString(
                                          'en-US',
                                          {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                          },
                                        )
                                    const orderedSlots = [...slots].sort(
                                      (a, b) => {
                                        const aStart =
                                          toMinutesSinceMidnight(
                                            a.start_time,
                                          ) ?? 0
                                        const bStart =
                                          toMinutesSinceMidnight(
                                            b.start_time,
                                          ) ?? 0
                                        return aStart - bStart
                                      },
                                    )
                                    const slotSummaryItems = orderedSlots.map(
                                      (slot) => {
                                        const fromLabel = slot.start_time
                                          ? formatSlotTime(slot.start_time)
                                          : 'TBD'
                                        const rangeLabel = slot.end_time
                                          ? formatTimeRangeLabel(
                                              fromLabel,
                                              formatSlotTime(slot.end_time),
                                            )
                                          : fromLabel
                                        return {
                                          id: String(slot.id),
                                          fromLabel,
                                          label: rangeLabel,
                                          price: Number(
                                            slot.price ??
                                              bookingCourt.court
                                                ?.booking_price ??
                                              0,
                                          ),
                                        }
                                      },
                                    )
                                    const slotMinuteRanges = orderedSlots
                                      .map((slot) => {
                                        const startMinutes =
                                          toMinutesSinceMidnight(
                                            slot.start_time,
                                          )
                                        const endMinutes =
                                          toMinutesSinceMidnight(slot.end_time)
                                        if (
                                          startMinutes === null ||
                                          endMinutes === null
                                        ) {
                                          return null
                                        }
                                        return { startMinutes, endMinutes }
                                      })
                                      .filter(
                                        (
                                          range,
                                        ): range is {
                                          startMinutes: number
                                          endMinutes: number
                                        } => Boolean(range),
                                      )
                                      .sort(
                                        (a, b) =>
                                          a.startMinutes - b.startMinutes,
                                      )
                                    const hasMultipleSlots =
                                      slotSummaryItems.length > 1
                                    const firstRange = slotMinuteRanges[0]
                                    const lastRange =
                                      slotMinuteRanges[
                                        slotMinuteRanges.length - 1
                                      ]
                                    const compactRangeLabel =
                                      hasMultipleSlots &&
                                      firstRange &&
                                      lastRange
                                        ? formatTimeRangeLabel(
                                            minutesToTimeString(
                                              roundMinutesToNearestHour(
                                                firstRange.startMinutes,
                                              ),
                                            ),
                                            minutesToTimeString(
                                              roundMinutesToNearestHour(
                                                lastRange.endMinutes,
                                              ),
                                            ),
                                          )
                                        : (slotSummaryItems[0]?.label ?? 'TBD')
                                    const bookingCourtSlotsKey = `${booking.id}-${bookingCourt.id}`
                                    const isCourtSlotsExpanded =
                                      expandedBookingCourtSlots.has(
                                        bookingCourtSlotsKey,
                                      )
                                    return (
                                      <div
                                        key={bookingCourt.id}
                                        className="bg-transparent"
                                      >
                                        <div className="mb-0">
                                          <strong className="font-semibold text-sm capitalize text-gray-800">
                                            {purposeLabel} Court {courtNumber}
                                          </strong>
                                        </div>
                                        <div className="pl-0.5">
                                          {hasSlotSummary ? (
                                            <button
                                              type="button"
                                              className={`flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-sm ${
                                                hasMultipleSlots
                                                  ? 'hover:bg-gray-100'
                                                  : 'cursor-default'
                                              }`}
                                              onClick={() => {
                                                if (!hasMultipleSlots) {
                                                  return
                                                }
                                                setExpandedBookingCourtSlots(
                                                  (prev) => {
                                                    const next = new Set(prev)
                                                    if (
                                                      next.has(
                                                        bookingCourtSlotsKey,
                                                      )
                                                    ) {
                                                      next.delete(
                                                        bookingCourtSlotsKey,
                                                      )
                                                    } else {
                                                      next.add(
                                                        bookingCourtSlotsKey,
                                                      )
                                                    }
                                                    return next
                                                  },
                                                )
                                              }}
                                              aria-label={
                                                isCourtSlotsExpanded
                                                  ? 'Hide all slots'
                                                  : 'Show all slots'
                                              }
                                            >
                                              <span className="text-sm font-semibold text-gray-700">
                                                {courtDateLabel}
                                              </span>
                                              <span className="inline-flex items-center gap-2 whitespace-nowrap text-gray-700">
                                                {compactRangeLabel}
                                                {hasMultipleSlots && (
                                                  <ChevronDown
                                                    className={`size-3.5 text-gray-500 transition-transform ${
                                                      isCourtSlotsExpanded
                                                        ? 'rotate-180'
                                                        : ''
                                                    }`}
                                                  />
                                                )}
                                              </span>
                                            </button>
                                          ) : (
                                            <div className="flex items-center justify-between gap-3 px-1.5 py-1">
                                              <span className="text-sm font-semibold text-gray-700">
                                                {courtDateLabel}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="pl-1 pb-2 pt-1 space-y-1">
                                          {hasSlotSummary && (
                                            <div className="space-y-1">
                                              {hasMultipleSlots &&
                                                isCourtSlotsExpanded &&
                                                slotSummaryItems.map(
                                                  (slotItem) => (
                                                    <div
                                                      key={slotItem.id}
                                                      className="flex items-center justify-between pl-4 py-0.5 text-sm"
                                                    >
                                                      <div className="flex items-center gap-2 text-gray-700 min-w-0">
                                                        <DynamicClock
                                                          time={
                                                            slotItem.fromLabel
                                                          }
                                                          className="size-3.5 flex-shrink-0"
                                                        />
                                                        <span className="truncate">
                                                          {slotItem.label}
                                                        </span>
                                                      </div>
                                                      <span className="pl-2">
                                                        ₱
                                                        {formatCurrency(
                                                          slotItem.price,
                                                        )}
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                        </div>

                        <div className="mt-auto pt-3 mb-[-1] flex items-center justify-between text-sm text-gray-800">
                          <span className="font-semibold">
                            Total ({slotCount} Slot{slotCount !== 1 ? 's' : ''})
                          </span>
                          <strong className="text-sm">
                            ₱{formatCurrency(booking.price)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {statusLabel === 'pending' && (
                      <div className="space-y-2 mt-5">
                        {(() => {
                          const isCancellingThisBooking =
                            cancellingBookingId === booking.id
                          return (
                            <>
                              {continuePaymentLink ? (
                                <Button
                                  type="button"
                                  size="lg"
                                  className="w-full"
                                  disabled={isCancellingThisBooking}
                                  asChild
                                >
                                  <a
                                    href={continuePaymentLink}
                                    rel="noreferrer"
                                  >
                                    Continue to Payment
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="lg"
                                  className="w-full"
                                  disabled={isCancellingThisBooking}
                                  onClick={() =>
                                    toast.error('Payment link not found', {
                                      description:
                                        'Please complete the booking again to get a payment link.',
                                    })
                                  }
                                >
                                  Continue to Payment
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="lg"
                                variant="outline"
                                className="mt-2 w-full"
                                disabled={isCancellingThisBooking}
                                onClick={() => handleCancelBooking(booking)}
                              >
                                {isCancellingThisBooking
                                  ? 'Cancelling...'
                                  : 'Cancel Booking'}
                              </Button>
                              <p className="text-xs text-center text-orange-500 mt-2">
                                Reservation held for{' '}
                                {isCancellingThisBooking
                                  ? '--:--'
                                  : (countdown ?? '00:00')}
                              </p>
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {statusLabel === 'confirmed' && (
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        {!bookingHasPassed && (
                          <Button
                            type="button"
                            size="lg"
                            className="w-full"
                            onClick={() => handleAddToCalendar(booking)}
                          >
                            Add to Calendar
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="lg"
                          className={`w-full ${bookingHasPassed ? 'col-span-2' : ''}`}
                          variant="outline"
                          onClick={() => handleShareVenue(booking)}
                        >
                          Share Venue
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </div>
              </div>
            </Card>
          )
            })}
          </React.Fragment>
        ))}
      </div>
        </div>
      </div>
    </div>
  )
}
