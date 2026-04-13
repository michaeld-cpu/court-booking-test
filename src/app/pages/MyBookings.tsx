import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Booking } from '../types';
import { Calendar, ChevronDown, Globe, ListFilter, Phone, User, Clock, Share2, CheckCircle2, XCircle, PlayCircle, AlertCircle, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../lib/api';
import { isAxiosError } from 'axios';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
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
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'confirmed' | 'cancelled' | 'pending'>('all');
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

  // Disable header interactions and darken background when dialog is open
  useEffect(() => {
    const header = document.querySelector('header');
    const root = document.getElementById('root');
    
    if (isConfirmCancelOpen) {
      header?.style.setProperty('pointer-events', 'none');
      if (root) {
        root.style.opacity = '0.5';
      }
    } else {
      header?.style.setProperty('pointer-events', 'auto');
      if (root) {
        root.style.opacity = '1';
      }
    }

    return () => {
      header?.style.setProperty('pointer-events', 'auto');
      if (root) {
        root.style.opacity = '1';
      }
    };
  }, [isConfirmCancelOpen]);

  const displayBookings = useMemo(() => {
    const baseBookings = remoteBookings.length > 0 ? remoteBookings : bookings;
    
    // Inject a fake Active booking for side-by-side previewing
    const fakeActiveBooking: Booking = {
      id: 'fake-active-001',
      courtId: 'court-11',
      courtName: 'Court 1',
      courtType: 'Pickleball',
      status: 'active',
      guestName: 'Michael Diopenes',
      venueContactNumber: '0917-123-4567',
      date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      timeSlotFrom: '09:00 AM',
      timeSlotTo: '11:00 AM',
      price: 600,
      operatorId: 'operator-f1',
      operatorName: 'PREMIUM PICKLEBALL ARENA',
      location: '123 Elite Sports Ave, Central City',
      city: 'Central City',
      bookingCourts: [
        {
          id: 1,
          court: {
            id: 1,
            number: 1,
            purpose: 'PICKLE',
            type: 'Pickleball'
          },
          slot_count: 2,
          slots: [
            { id: 1, start_time: '09:00', end_time: '10:00' },
            { id: 2, start_time: '10:00', end_time: '11:00' }
          ]
        }
      ]
    };

    return [fakeActiveBooking, ...baseBookings];
  }, [remoteBookings, bookings]);

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
    let result = displayBookings;

    // Status Filter
    if (filterStatus !== 'all') {
      result = result.filter((booking) => {
        const { statusLabel } = getStatusMeta(booking);
        // Map 'cancelled' and 'expired' to 'cancelled' if that's what the user wants, 
        // or keep them separate. The screenshot shows Cancelled.
        if (filterStatus === 'cancelled') {
          return statusLabel === 'cancelled' || statusLabel === 'expired';
        }
        if (filterStatus === 'active') {
          return statusLabel === 'active' || statusLabel === 'confirmed';
        }
        return statusLabel === filterStatus;
      });
    }

    // Calendar Range Filter
    if (calendarRange) {
      result = result.filter((booking) => {
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
    }

    const statusPriority: Record<string, number> = {
      active: 0,
      confirmed: 1,
      pending: 2,
      expired: 3,
      cancelled: 4,
    };

    return [...result].sort((a, b) => {
      const aStatus = getStatusMeta(a).statusLabel;
      const bStatus = getStatusMeta(b).statusLabel;
      const aPrio = statusPriority[aStatus] ?? 99;
      const bPrio = statusPriority[bStatus] ?? 99;

      if (aPrio !== bPrio) {
        return aPrio - bPrio;
      }
      return 0;
    });
  }, [displayBookings, calendarMode, calendarRange, filterStatus, now]);

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
    setBookingToCancel(booking);
    setIsConfirmCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;

    try {
      setCancellingBookingId(bookingToCancel.id);
      setIsConfirmCancelOpen(false);
      await api.post(`/api/bookings/${bookingToCancel.id}/cancel`);
      toast.success('Booking cancelled');
      await fetchBookings({ background: false });
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? 'Unable to cancel booking.'
        : 'Unable to cancel booking.';
      toast.error(message);
    } finally {
      setCancellingBookingId(null);
      setBookingToCancel(null);
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

    const statusOrder = ['active', 'confirmed', 'pending', 'expired', 'cancelled'];
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
      <div className="pt-0 pb-0 md:pb-8 min-h-svh">
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
      <div className="pt-4 md:pt-4 pb-0 md:pb-12">
        <h1 className="text-xl md:text-2xl font-bold mb-5 md:mb-8">Bookings</h1>
        <div className="text-red-600">{loadError}</div>
      </div>
    );
  }

  if (displayBookings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <EmptyState
          wrapperClassName="flex items-center justify-center"
          icon={
            <div className="rounded-full bg-gray-100/80 p-4">
              <Calendar className="size-8 text-gray-400" />
            </div>
          }
          title="No bookings yet"
          description={
            <>
              Your bookings will appear here <br />after you complete a payment.
            </>
          }
          action={
            <Button asChild className="h-11 px-6 py-2.5 rounded-lg text-sm font-medium w-fit">
              <Link to="/">Browse Courts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="pt-0 pb-16 md:pb-24 min-h-svh">
      <div className="mx-auto w-full max-w-[1300px] mb-2 md:mb-6 flex items-center justify-between px-4 md:px-0 py-2 border-b border-gray-100 sm:border-none">
        <h1
          className="text-2xl md:text-3xl font-bold font-bebas uppercase tracking-wide text-gray-900"
        >
          My Bookings
        </h1>
      </div>

      <div className="mx-auto w-full max-w-[1300px]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
          <aside className="hidden md:block order-2 md:order-1 md:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:rounded-lg">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Calendar</p>
                <div className="inline-flex rounded-md border border-gray-100 bg-gray-50/50 p-0.5">
                  <button
                    type="button"
                    className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight transition-all ${
                      calendarMode === 'booking'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    onClick={() => setCalendarMode('booking')}
                  >
                    Booking
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight transition-all ${
                      calendarMode === 'play'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    onClick={() => setCalendarMode('play')}
                  >
                    Play
                  </button>
                </div>
              </div>
              <div className="w-full">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, -1))}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <p className="text-sm font-bold text-gray-900">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
                    <div key={label} className="py-2">
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
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCalendarSelect(day)}
                        className={`relative inline-flex h-10 items-center justify-center rounded-md text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-black text-white shadow-md transform scale-105'
                            : isOutsideMonth
                              ? 'text-gray-300 hover:text-gray-400'
                              : 'text-gray-700 hover:bg-gray-50'
                        } ${isToday && !isSelected ? 'text-blue-600 font-bold' : ''}`}
                      >
                        {format(day, 'd')}
                        {hasBooking && !isSelected && (
                          <span
                            className="absolute bottom-1.5 h-1 w-4 rounded-full bg-black/10"
                          />
                        )}
                        {isSelected && (
                          <span className="sr-only">(Selected)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {calendarRange && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-4 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-900"
                    onClick={() => {
                      setSelectedCalendarDay(undefined);
                      setCalendarRange(null);
                    }}
                  >
                    Clear Filter
                  </Button>
                )}
              </div>
            </div>
          </aside>

          <div className="order-1 md:order-2 md:col-span-2 flex flex-col gap-4">
            {/* Status Tabs/Pills */}
            <div className="py-3 -mr-4 pr-4 md:mr-0 md:pr-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar sm:pb-0">
                <Select
                  value={groupBy}
                  onValueChange={(value: 'booking_date' | 'status') => setGroupBy(value)}
                >
                  <SelectTrigger className="flex h-9 w-fit items-center gap-1.5 rounded-full border border-gray-100 bg-white px-4 py-1.5 text-xs font-bold text-gray-900 shadow-sm transition-all hover:border-gray-300 focus:ring-0 focus:ring-offset-0 ring-0 border-none outline-none ring-offset-0">
                    <ListFilter className="size-3.5 text-gray-900" />
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-gray-100 bg-white p-1 shadow-lg ring-0">
                    <SelectItem value="booking_date" className="rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 focus:bg-gray-50 focus:text-gray-900">
                      Booking Date
                    </SelectItem>
                    <SelectItem value="status" className="rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 focus:bg-gray-50 focus:text-gray-900">
                      Status
                    </SelectItem>
                  </SelectContent>
                </Select>
                {groupBy === 'status' && (
                  <>
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'active', label: 'Active' },
                      { id: 'confirmed', label: 'Confirmed' },
                      { id: 'pending', label: 'Pending' },
                      { id: 'cancelled', label: 'Cancelled' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setFilterStatus(tab.id as any)}
                        className={`whitespace-nowrap rounded-full px-5 py-1.5 text-xs font-bold transition-all ${
                          filterStatus === tab.id
                            ? 'bg-black text-white shadow-md transform scale-105'
                            : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300 hover:text-gray-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className={`grid w-full grid-cols-1 gap-3 md:gap-4 ${
              groupBy === 'status' ? 'mt-0' : ''
            }`}>
              {groupedBookingSections.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 mb-3">
                    <ListFilter className="size-6 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">No results found</p>
                  <p className="text-xs text-gray-500 mt-1">Try clearing your filters or select a different date.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4 text-xs"
                    onClick={() => {
                      setFilterStatus('all');
                      setSelectedCalendarDay(undefined);
                      setCalendarRange(null);
                    }}
                  >
                    Reset all filters
                  </Button>
                </div>
              )}
              {groupedBookingSections.map((section) => (
                <React.Fragment key={section.key}>
                  {section.label && (
                    <p className="px-5 md:px-0 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 mt-2 mb-1">
                      {section.label}
                    </p>
                  )}
                  {section.items.map(({ booking, index }) => {
                    const bookingDate = new Date(booking.date);
                    const { normalizedStatus, statusLabel } = getStatusMeta(booking);
                    const statusText = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
                    
                    // Status Badge Config
                    const statusConfig: Record<string, { bg: string, text: string, icon: any }> = {
                      confirmed: { bg: 'bg-[#E8F5E9]', text: 'text-[#2E7D32]', icon: CheckCircle2 },
                      cancelled: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', icon: XCircle },
                      pending: { bg: 'bg-[#FFF8E1]', text: 'text-[#F57F17]', icon: PlayCircle },
                      expired: { bg: 'bg-[#F5F5F5]', text: 'text-[#757575]', icon: Clock },
                      failed: { bg: 'bg-[#FFEBEE]', text: 'text-[#C62828]', icon: AlertCircle },
                    };
                    const currentStatus = statusConfig[normalizedStatus] || statusConfig.expired;
                    const StatusIcon = currentStatus.icon;

                    const bookingCourts = booking.bookingCourts ?? [];
                    const slotCount = bookingCourts.reduce((total, bookingCourt) => {
                      if (typeof bookingCourt.slot_count === 'number') {
                        return total + bookingCourt.slot_count;
                      }
                      return total + (bookingCourt.slots?.length ?? 0);
                    }, 0);
                    
                    const firstSlotDate = bookingCourts[0]?.slots?.[0]?.date;
                    const playDateLabel = firstSlotDate 
                      ? format(new Date(firstSlotDate), 'EEE, MMM d, yyyy')
                      : format(bookingDate, 'EEE, MMM d, yyyy');

                    const remainingMs = booking.expiresAfterTs
                      ? new Date(booking.expiresAfterTs as string).getTime() + PENDING_COUNTDOWN_EXTENSION_MS - now
                      : null;
                    const remainingSeconds = remainingMs ? Math.max(0, Math.floor(remainingMs / 1000)) : 0;
                    const countdown = remainingSeconds
                      ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
                      : null;
                    
                    const isBookingExpired = statusLabel === 'expired';
                    const bookingHasPassed = !!getPlayDatesForBooking(booking).find(
                      (date) => date.getTime() + 24 * 60 * 60 * 1000 < now,
                    );
                    const continuePaymentLink = getPaymentLinkForBooking(booking.id);
                    const venuePhone = String(booking.venueContactNumber ?? '').trim();

                    // Dynamic Status Styling for the new lime-green ticket card side
                    // Dynamic Status Styling for the navy background
                    const isActive = statusLabel === 'confirmed' || statusLabel === 'active';

                    // Dynamic Status Styling depending on card theme
                    const getStatusBadgeClasses = (status: string) => {
                      if (isActive) {
                        return 'bg-[#C8F542]/10 text-[#C8F542] border border-[#C8F542]/20';
                      }
                      switch (status) {
                        case 'pending': return 'bg-amber-50 text-amber-600 border border-amber-200';
                        case 'cancelled': 
                        case 'expired': return 'bg-red-50 text-red-600 border border-red-200';
                        default: return 'bg-gray-50 text-gray-600 border border-gray-200';
                      }
                    };

                    const bookingIdShort = booking.id.length > 8 ? booking.id.substring(0, 8).toUpperCase() : booking.id.toUpperCase();

                    return (
                      <div key={booking.id} className="flex flex-col">
                        <div className={`overflow-hidden rounded-[1.25rem] shadow-sm relative flex flex-col sm:flex-row mb-4 items-stretch ${isActive ? 'bg-[#0A1E2D] ring-1 ring-white/10 shadow-lg' : 'bg-white ring-1 ring-gray-200'}`}>
                          {/* LEFT PANEL */}
                          <div className={`flex-1 flex flex-col p-5 sm:p-6 min-w-0 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                            <div className="flex w-full justify-between items-start mb-3">
                              <div className="flex flex-col gap-1.5">
                                <div className={`text-xl md:text-2xl font-bebas tracking-wide uppercase break-words pr-2 leading-none ${isActive ? 'text-white' : 'text-gray-900'}`}>{booking.operatorName}</div>
                                <div className={`flex items-start gap-1.5 text-xs font-medium pr-4 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                  <MapPin className={`size-3.5 shrink-0 mt-0.5 ${isActive ? 'text-[#C8F542]' : 'text-gray-400'}`} />
                                  <span className="line-clamp-2">{booking.location}</span>
                                </div>
                                <div className={`text-[10px] font-bold tracking-widest mt-0.5 whitespace-nowrap ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>PK-{bookingIdShort}</div>
                              </div>
                            </div>
                            
                            <div className={`border-t w-full mb-4 ${isActive ? 'border-white/10' : 'border-gray-100'}`}></div>

                            {/* Court / Sport */}
                            <div className="flex flex-col space-y-2 mb-5">
                              <div className={`text-[8.5px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border w-fit shrink-0 mb-0.5 ${isActive ? 'text-[#C8F542] border-[#C8F542]/40 bg-[#C8F542]/10' : 'text-gray-500 border-gray-200 bg-gray-50'}`}>
                                {bookingCourts[0]?.court?.purpose || booking.courtType}
                              </div>
                              <h3 className={`text-xl sm:text-2xl font-bold tracking-tight line-clamp-1 ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                {(() => {
                                  const fullText = bookingCourts[0]?.court?.number 
                                    ? `Court ${bookingCourts[0]?.court?.number}` 
                                    : (booking.courtName || '');
                                  const match = fullText.match(/^(.*?)\s*(\d+)$/);
                                  if (match) {
                                    return (
                                      <>
                                        {match[1]} <span className="text-[0.65em] opacity-60 font-medium ml-0.5">#{match[2]}</span>
                                      </>
                                    );
                                  }
                                  return fullText;
                                })()}
                              </h3>
                            </div>

                            {/* Date / Time / Duration / Cost Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-auto">
                               <div className="flex flex-col">
                                  <div className={`flex items-center gap-1.5 text-[8.5px] sm:text-[9px] uppercase tracking-widest font-bold mb-1.5 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                     <Calendar className={`size-3.5 ${isActive ? 'text-[#C8F542]' : 'text-gray-400'}`}/> DATE
                                  </div>
                                  <div className={`text-[11px] sm:text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>{playDateLabel}</div>
                               </div>
                               <div className={`flex flex-col border-l pl-3 sm:pl-4 ${isActive ? 'border-white/10' : 'border-gray-200'}`}>
                                  <div className={`flex items-center gap-1.5 text-[8.5px] sm:text-[9px] uppercase tracking-widest font-bold mb-1.5 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                     <Clock className={`size-3.5 ${isActive ? 'text-[#C8F542]' : 'text-gray-400'}`}/> TIME
                                  </div>
                                  <div className={`text-[11px] sm:text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                    {bookingCourts[0]?.slots?.[0]?.start_time 
                                      ? formatTimeRangeLabel(bookingCourts[0].slots[0].start_time, bookingCourts[bookingCourts.length-1]?.slots?.[(bookingCourts[bookingCourts.length-1]?.slots?.length || 1) - 1]?.end_time || '')
                                      : 'TBD'}
                                  </div>
                               </div>
                               <div className={`flex flex-col border-l pl-3 sm:pl-4 ${isActive ? 'border-white/10' : 'border-gray-200'}`}>
                                  <div className={`flex items-center gap-1.5 text-[8.5px] sm:text-[9px] uppercase tracking-widest font-bold mb-1.5 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                     DURATION
                                  </div>
                                  <div className={`text-[11px] sm:text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                    {slotCount} hour{slotCount !== 1 ? 's' : ''}
                                  </div>
                               </div>
                               <div className={`flex flex-col border-l pl-3 sm:pl-4 ${isActive ? 'border-white/10' : 'border-gray-200'}`}>
                                  <div className={`flex items-center gap-1.5 text-[8.5px] sm:text-[9px] uppercase tracking-widest font-bold mb-1.5 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                     TOTAL COST
                                  </div>
                                  <div className={`text-[11px] sm:text-sm font-bold tracking-tight ${isActive ? 'text-[#C8F542]' : 'text-gray-900'}`}>
                                    ₱{formatCurrency(Number(booking.price ?? 0))}
                                  </div>
                               </div>
                            </div>

                            <div className={`mt-5 pt-4 border-t flex items-center justify-between ${isActive ? 'border-white/10' : 'border-gray-100'}`}>
                              <div className="flex items-center">
                                <span className={`text-[8.5px] uppercase font-bold tracking-widest mr-2 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>BOOKED BY</span>
                                <span className={`text-xs font-semibold tracking-tight ${isActive ? 'text-gray-300' : 'text-gray-700'}`}>{booking.guestName || 'David Garcia'}</span>
                              </div>
                              <div className={`text-[9px] font-medium hidden sm:block italic ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                                Keep this ticket handy.
                              </div>
                            </div>

                            {/* Action Buttons Section */}
                            {statusLabel === 'pending' && (
                              <div className="mt-5 pt-4 border-t flex flex-col gap-2 w-full border-gray-50">
                                <div className="flex flex-col sm:flex-row gap-2">
                                  {continuePaymentLink ? (
                                    <Button className="flex-1 h-11 bg-black text-white hover:bg-neutral-800 rounded-lg font-bold text-[11px] uppercase tracking-widest shadow-md" asChild>
                                      <a href={continuePaymentLink} target="_blank" rel="noreferrer">Pay Now</a>
                                    </Button>
                                  ) : (
                                    <Button className="flex-1 h-11 bg-black text-white hover:bg-neutral-800 rounded-lg font-bold text-[11px] uppercase tracking-widest shadow-md" onClick={() => toast.error('Payment link not found')}>
                                      Pay Now
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    className="sm:w-[120px] h-11 border-gray-300 text-gray-700 bg-transparent rounded-lg font-bold text-[10px] uppercase tracking-widest hover:text-black hover:bg-gray-50 transition-colors"
                                    onClick={() => handleCancelBooking(booking)}
                                    disabled={cancellingBookingId === booking.id}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                                <div className="text-center sm:text-left mt-1">
                                  <span className="text-[10px] bg-red-50 font-bold text-red-600 rounded-md px-2 py-1 inline-block uppercase tracking-widest animate-pulse border border-red-100">
                                    {isBookingExpired ? 'Expired' : `Holds for ${countdown ?? '00:00'}`}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* RIGHT PANEL: Status Stub */}
                          <div className={`w-full sm:w-[150px] shrink-0 p-5 sm:px-4 sm:py-6 flex flex-col justify-center items-center ${isActive ? 'bg-[#C8F542] text-[#0A1E2D]' : 'bg-gray-50 text-gray-900 border-t sm:border-t-0 sm:border-l border-gray-200'}`}>
                            <div className="text-[10px] uppercase font-bold tracking-widest opacity-60 mb-2">Pass Status</div>
                            <div className={`font-bebas tracking-wide uppercase leading-none text-center w-full whitespace-nowrap ${statusText.length > 7 ? 'text-2xl sm:text-2xl' : 'text-3xl lg:text-4xl'}`}>
                              {statusText}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Dialog */}
      <AlertDialog open={isConfirmCancelOpen} onOpenChange={(open) => {
        // Prevent closing by pressing escape or clicking outside
        if (!open && cancellingBookingId) {
          return;
        }
        setIsConfirmCancelOpen(open);
      }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">
              Cancel Booking
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600 mt-2">
              {bookingToCancel && (
                <div className="space-y-2">
                  <p>
                    Are you sure you want to cancel your booking for <strong>{bookingToCancel.operatorName}</strong>?
                  </p>
                  <p className="text-xs text-gray-500">
                    This action cannot be undone.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 pt-4">
            <AlertDialogCancel className="flex-1">
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
