import { useParams, useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { operators, mockCourts } from '../data/mockData';
import { Court, TimeSlot, Operator } from '../types';
import type { CartItem } from '../types';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowLeft,
  Bookmark,
  Facebook,
  Instagram,
  Twitter,
  Calendar,
  Share2,
  Check,
  Globe,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Icons } from '../components/ui/icons';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { BookingModal } from '../components/BookingModal';
import { BookingSummaryModal } from '../components/BookingSummaryModal';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { CourtCard } from '../components/CourtCard';
import { VenueMapView } from '../components/VenueMapView';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { addHours, format, isSameDay, parse } from 'date-fns';
import { DynamicClock } from '../components/DynamicClock';
import { api } from '../lib/api';
import { courtTypeIcons } from '../lib/courtTypeColors';
import { formatCurrency } from '../lib/formatCurrency';
import { formatTimeRangeLabel } from '../lib/timeFormat';
import { mapAvailabilitySlots } from '../lib/slotAvailability';
import { maxSlotSelection } from '../lib/config';
import { toast } from '@/app/lib/toast';
import { resolveVenueBannerUrl } from '../lib/venueBanner';
import {
  getMinimumBookableDate,
  shouldShiftBookingDateToNextDay,
} from '../lib/bookingDate';

const courtImages: Record<string, string> = {
  pickleball: 'https://images.unsplash.com/photo-1580763850522-504d40a05c50?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWNrbGViYWxsJTIwY291cnR8ZW58MXx8fHwxNzY2MDQ3OTgwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  basketball: 'https://images.unsplash.com/photo-1710378844976-93a6538671ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXNrZXRiYWxsJTIwY291cnQlMjBpbmRvb3J8ZW58MXx8fHwxNzY1OTYxMTYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  tennis: 'https://images.unsplash.com/photo-1620742820748-87c09249a72a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjb3VydHxlbnwxfHx8fDE3NjU5ODM0MDZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  badminton: 'https://images.unsplash.com/photo-1626926938421-90124a4b83fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWRtaW50b24lMjBjb3VydHxlbnwxfHx8fDE3NjU5MzM5NDV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  volleyball: 'https://images.unsplash.com/photo-1611635395922-31a9afa796ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2b2xsZXliYWxsJTIwYmVhY2h8ZW58MXx8fHwxNzY2MDQ3OTgxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
};

const getRangeIndex = (rangeId: string): number => {
  const parsed = Number(String(rangeId).replace('range-', ''));
  return Number.isNaN(parsed) ? -1 : parsed;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normalizeVenueKey = (value: string | null | undefined) =>
  normalizeText(value).replace(/^venue-/, '');

interface OperatorPageProps {
  onAddToCart: (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot, courtId: string, date: Date) => void;
  onPayNow: (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot, courtId: string, date: Date) => void;
  bookmarkedOperatorIds: string[];
  onToggleBookmark: (operatorId: string, operator?: Operator) => void;
  requireAuth: (
    action: () => void,
    options?: { runAfterLogin?: boolean },
  ) => boolean;
  hasPendingBookings?: boolean;
  cartItems?: CartItem[];
}

export function OperatorPage({
  onAddToCart,
  onPayNow,
  bookmarkedOperatorIds,
  onToggleBookmark,
  requireAuth,
  hasPendingBookings,
  cartItems = [],
}: OperatorPageProps) {
  const { operatorId, venueSlug } = useParams<{ operatorId?: string; venueSlug?: string }>();
  const resolvedOperatorId = React.useMemo(() => {
    const rawId = operatorId ?? venueSlug;
    if (!rawId) {
      return undefined;
    }
    if (rawId.startsWith('venue-')) {
      return rawId;
    }
    const numericMatch = rawId.match(/^(\d+)(?:-|$)/);
    if (numericMatch) {
      return `venue-${numericMatch[1]}`;
    }
    return rawId;
  }, [operatorId, venueSlug]);
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCourts, setIsLoadingCourts] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([
    getMinimumBookableDate(),
  ]);
  const [isDesktopDatePickerOpen, setIsDesktopDatePickerOpen] = useState(false);
  const [isMobileDatePickerOpen, setIsMobileDatePickerOpen] = useState(false);
  const [isMobileDateBarPinned, setIsMobileDateBarPinned] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [preselectedTimeSlot, setPreselectedTimeSlot] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, Record<string, string[]>>>({});
  const [expandedCourtId, setExpandedCourtId] = useState<string | null>(null);
  const [isFloatingExpanded, setIsFloatingExpanded] = useState(false);
  const selectionLimit = maxSlotSelection;
  const mobileDateBarRef = useRef<HTMLElement | null>(null);
  const mobileDateSentinelRef = useRef<HTMLDivElement | null>(null);

  const state = location.state as { operator?: Operator; courts?: Court[] } | null;
  const [operatorData, setOperatorData] = useState<Operator | null>(
    state?.operator ?? operators.find(op => op.id === resolvedOperatorId) ?? null
  );
  const [operatorCourts, setOperatorCourts] = useState<Court[]>(
    state?.courts ?? mockCourts.filter(court => court.operatorId === resolvedOperatorId)
  );
  const operatorDataRef = useRef<Operator | null>(operatorData);
  const operator = operatorData;
  const googleMapsUrl = operator
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${operator.coordinates.lat},${operator.coordinates.lng}`)}`
    : '#';

  const getVenueBannerUrl = (venue: any, preferOptimized: boolean) => {
    const banner = venue?.banner ?? venue?.image ?? venue?.images?.[0];
    if (preferOptimized) {
      return (
        banner?.optimized_url ??
        banner?.optimizedUrl ??
        banner?.url ??
        banner?.src ??
        null
      );
    }
    return banner?.url ?? banner?.src ?? banner?.optimized_url ?? banner?.optimizedUrl ?? null;
  };

  const normalizeAddress = (address?: string | null) => {
    if (!address) {
      return 'Unknown Address';
    }
    return address
      .replace(/,\s*philippines\b/gi, '')
      .replace(/\s*,\s*$/, '')
      .trim();
  };

  const buildDefaultSlots = (price: number): TimeSlot[] => [
    { id: 's1', time: '08:00 AM', available: true, price },
    { id: 's2', time: '09:00 AM', available: true, price },
    { id: 's3', time: '10:00 AM', available: true, price },
    { id: 's4', time: '11:00 AM', available: true, price },
    { id: 's5', time: '12:00 PM', available: true, price },
    { id: 's6', time: '01:00 PM', available: true, price },
    { id: 's7', time: '02:00 PM', available: true, price },
    { id: 's8', time: '03:00 PM', available: true, price },
    { id: 's9', time: '04:00 PM', available: true, price },
    { id: 's10', time: '05:00 PM', available: true, price },
    { id: 's11', time: '06:00 PM', available: true, price },
    { id: 's12', time: '07:00 PM', available: true, price },
  ];

  const mapSlots = (slots: any[]): TimeSlot[] => {
    if (!Array.isArray(slots) || slots.length === 0) {
      return buildDefaultSlots(0);
    }
    const mapped = mapAvailabilitySlots(slots);
    return mapped.length > 0 ? mapped : buildDefaultSlots(0);
  };

  const renderDateLabel = (date: Date) => {
    if (isSameDay(date, new Date())) {
      return `Today - ${format(date, 'MMM dd, yyyy')}`;
    }
    return format(date, 'EEE, MMM dd, yyyy');
  };

  useEffect(() => {
    const current = selectedDates[0];
    if (!current) return;
    if (shouldShiftBookingDateToNextDay(current, new Date())) {
      setSelectedDates([getMinimumBookableDate()]);
    }
  }, [selectedDates]);

  useEffect(() => {
    if (operator?.name) {
      document.title = `${operator.name} | Korte.ph`;
      return;
    }
    document.title = 'Venue | Korte.ph';
  }, [operator?.name]);


  useEffect(() => {
    let isActive = true;
    const fetchVenue = async () => {
      if (!resolvedOperatorId) {
        return;
      }
      const venueId = resolvedOperatorId.startsWith('venue-')
        ? resolvedOperatorId.replace('venue-', '')
        : resolvedOperatorId;

      setIsLoading(true);
      try {
        const response = await api.get(`/api/venues/${venueId}`);
        const venue = response.data?.data ?? response.data;
        if (!venue || !isActive) {
          return;
        }

        const coordPair = Array.isArray(venue.coordinates?.coordinates)
          ? venue.coordinates.coordinates
          : null;
        const derivedCoordinates = {
          lat: coordPair?.[1] ?? venue.latitude ?? 0,
          lng: coordPair?.[0] ?? venue.longitude ?? 0,
        };
        const operatorIdValue = `venue-${venue.id}`;
        const operatorName = venue.name ?? 'Unknown Venue';
        const normalizedAddress = normalizeAddress(venue.address);
        const cityParts = normalizedAddress.split(',').map((part) => part.trim());
        const cityGuess =
          cityParts.find((part) => /city|manila|cebu|davao/i.test(part)) ??
          cityParts[cityParts.length - 2] ??
          cityParts[cityParts.length - 1] ??
          'Unknown';

        const mappedOperator: Operator = {
          id: operatorIdValue,
          name: operatorName,
          location: normalizedAddress,
          city: cityGuess,
          isCovered: venue.is_covered ?? undefined,
          description: venue.description ?? '',
          amenities: [],
          rating: 0,
          phone: venue.contact_number ?? '',
          email: '',
          operatingHours: '',
          websiteUrl: venue.website_url ?? venue.websiteUrl ?? undefined,
          image: resolveVenueBannerUrl(
            getVenueBannerUrl(venue, false),
            operatorIdValue,
          ),
          profileImage: resolveVenueBannerUrl(
            getVenueBannerUrl(venue, true),
            `${operatorIdValue}-profile`,
          ),
          coordinates: derivedCoordinates,
          socialMedia: {
            facebook: venue.facebook_link ?? undefined,
          },
        };

        if (!isActive) {
          return;
        }

        setOperatorData(mappedOperator);
      } catch {
        // keep existing state when API fails
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchVenue();

    return () => {
      isActive = false;
    };
  }, [resolvedOperatorId]);

  useEffect(() => {
    operatorDataRef.current = operatorData;
  }, [operatorData]);

  useEffect(() => {
    let isActive = true;

    const fetchCourtSlots = async () => {
      if (!resolvedOperatorId || selectedDates.length === 0) {
        return;
      }
      const venueId = resolvedOperatorId.startsWith('venue-')
        ? resolvedOperatorId.replace('venue-', '')
        : resolvedOperatorId;

      const date = selectedDates[0];
      const startDate = new Date(date);
      const endDate = new Date(date);
      if (isSameDay(date, new Date())) {
        const nextHour = addHours(new Date(), 1);
        startDate.setHours(nextHour.getHours(), 0, 0, 0);
      } else {
        startDate.setHours(0, 0, 0, 0);
      }
      endDate.setHours(23, 59, 59, 0);

      try {
        setIsLoadingCourts(true);
        const response = await api.get(`/api/venues/${venueId}/slots`, {
          params: {
            start: format(startDate, 'yyyy-MM-dd HH:mm:ss'),
            end: format(endDate, 'yyyy-MM-dd HH:mm:ss'),
          },
        });
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];

        const operatorSnapshot = operatorDataRef.current;
        const operatorName = operatorSnapshot?.name ?? 'Venue';
        const operatorLocation = operatorSnapshot?.location ?? '';
        const operatorCity = operatorSnapshot?.city ?? '';
        const normalizedOperatorId =
          operatorSnapshot?.id ?? `venue-${venueId}`;

        const mappedCourts: Court[] = data.map((entry: any, index: number) => {
          const courtInfo = entry.court ?? entry;
          const courtId = String(courtInfo.id ?? entry.court_id ?? `${venueId}-court-${index + 1}`);
          const courtName = courtInfo.name ?? `Court ${courtInfo.number ?? entry.number ?? index + 1}`;
          const purposeLabel = courtInfo.purpose ?? courtInfo.type ?? entry.type ?? 'Others';
          return {
            id: courtId,
            name: courtName,
            type: courtInfo.type ?? purposeLabel,
            purpose: purposeLabel,
            isCovered: operatorData?.isCovered ?? undefined,
            operatorId: normalizedOperatorId,
            operatorName,
            location: operatorLocation,
            city: operatorCity,
            image: courtInfo.image ?? '',
            amenities: [],
            rating: 0,
            pricePerHour: 0,
            availableSlots: mapSlots(entry.slots ?? courtInfo.slots ?? entry.time_slots ?? []),
          };
        });

        if (isActive && mappedCourts.length > 0) {
          setOperatorCourts(mappedCourts);
          // Auto-expand the first court
          if (expandedCourtId === null) {
            setExpandedCourtId(mappedCourts[0].id);
          }
        }
      } catch {
        // keep existing courts when API fails
      } finally {
        if (isActive) {
          setIsLoadingCourts(false);
        }
      }
    };

    fetchCourtSlots();

    return () => {
      isActive = false;
    };
  }, [resolvedOperatorId, selectedDates]);

  useEffect(() => {
    if (!selectedCourt) {
      return;
    }
    const refreshedCourt = operatorCourts.find(
      (court) => court.id === selectedCourt.id,
    );
    if (!refreshedCourt) {
      return;
    }
    setSelectedCourt((prev) => {
      if (!prev || prev.id !== refreshedCourt.id) {
        return prev;
      }
      if (prev.availableSlots === refreshedCourt.availableSlots) {
        return prev;
      }
      return {
        ...prev,
        ...refreshedCourt,
      };
    });
  }, [operatorCourts, selectedCourt]);

  useEffect(() => {
    const sentinel = mobileDateSentinelRef.current;
    if (!sentinel) {
      return;
    }

    if (window.innerWidth >= 640) {
      setIsMobileDateBarPinned(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Once sentinel scrolls out of view, sticky bar has reached the top.
        setIsMobileDateBarPinned(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, []);

  if (!operator) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center text-gray-600">Loading venue...</div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Operator Not Found</h1>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  // Toggle time slot selection
  const toggleTimeSlot = (courtId: string, dateStr: string, rangeId: string) => {
    if (!requireAuth(() => toggleTimeSlot(courtId, dateStr, rangeId))) {
      return;
    }

    setSelectedSlots((prev) => {
      const courtSlots = prev[courtId] || {};
      const dateSlots = courtSlots[dateStr] || [];
      const court = operatorCourts.find((value) => value.id === courtId);
      if (!court) {
        return prev;
      }

      if (dateSlots.includes(rangeId)) {
        // Remove the slot
        const removedIndex = getRangeIndex(rangeId);
        const selectedIndices = dateSlots.map((id) => getRangeIndex(id));
        const minSelectedIndex = Math.min(...selectedIndices);
        const newDateSlots =
          removedIndex === minSelectedIndex
            ? dateSlots
              .filter((id) => id !== rangeId)
              .sort((a, b) => getRangeIndex(a) - getRangeIndex(b))
            : dateSlots
              .filter((id) => getRangeIndex(id) < removedIndex)
              .sort((a, b) => getRangeIndex(a) - getRangeIndex(b));
        if (newDateSlots.length === 0) {
          const { [dateStr]: _, ...restDates } = courtSlots;
          if (Object.keys(restDates).length === 0) {
            const { [courtId]: __, ...restCourts } = prev;
            return restCourts;
          }
          return { ...prev, [courtId]: restDates };
        }
        return { ...prev, [courtId]: { ...courtSlots, [dateStr]: newDateSlots } };
      } else {
        const totalSelectedForCourt = Object.values(courtSlots).reduce(
          (total, slots) => total + slots.length,
          0
        );
        const nextIndices = [
          ...dateSlots.map((id) => getRangeIndex(id)),
          getRangeIndex(rangeId),
        ];
        const minIndex = Math.min(...nextIndices);
        const maxIndex = Math.max(...nextIndices);
        const filledDateSlots = Array.from(
          { length: maxIndex - minIndex + 1 },
          (_, offset) => `range-${minIndex + offset}`,
        );
        const additionalForDate = filledDateSlots.filter(
          (id) => !dateSlots.includes(id),
        ).length;

        if (totalSelectedForCourt + additionalForDate > selectionLimit) {
          toast.warning('Slot limit reached', {
            description: `You can only select up to ${selectionLimit} slots per court.`,
          });
          return prev;
        }

        const hasUnavailableInBetween = filledDateSlots.some((id) => {
          const rangeIndex = getRangeIndex(id);
          const startSlot = court.availableSlots[rangeIndex];
          return !startSlot || !startSlot.available;
        });
        if (hasUnavailableInBetween) {
          toast.info('Cannot skip unavailable slots', {
            description: 'Select slots within an available continuous block.',
          });
          return prev;
        }
        // Add the slot
        return {
          ...prev,
          [courtId]: {
            ...courtSlots,
            [dateStr]: filledDateSlots.sort(
              (a, b) => getRangeIndex(a) - getRangeIndex(b),
            ),
          }
        };
      }
    });
  };

  // Calculate total booking details
  const calculateTotals = () => {
    let totalHours = 0;
    let totalPrice = 0;
    let totalDays = 0;

    Object.entries(selectedSlots).forEach(([courtId, dateSlots]) => {
      const court = operatorCourts.find(c => c.id === courtId);
      if (!court) return;

      Object.entries(dateSlots).forEach(([dateStr, rangeIds]) => {
        const sortedRangeIds = [...rangeIds].sort(
          (a, b) => getRangeIndex(a) - getRangeIndex(b),
        );
        if (rangeIds.length > 0) {
          totalDays++;
        }
        sortedRangeIds.forEach((rangeId) => {
          const rangeIndex = parseInt(rangeId.replace('range-', '').split('-')[0]);
          if (rangeIndex >= 0 && rangeIndex < court.availableSlots.length - 1) {
            const startSlot = court.availableSlots[rangeIndex];
            totalHours += 1;
            totalPrice += startSlot.price;
          }
        });
      });
    });

    return { totalHours, totalPrice, totalDays, hasSelections: totalHours > 0 };
  };

  const totals = calculateTotals();

  // Calculate booking details for the summary modal
  const calculateBookingDetails = () => {
    const bookingsByCourtAndDate: Array<{
      court: Court;
      date: string;
      ranges: Array<{ startSlot: TimeSlot; endSlot: TimeSlot; label: string; price: number }>;
      totalPrice: number;
      totalHours: number;
    }> = [];

    let grandTotalPrice = 0;
    let grandTotalHours = 0;

    Object.entries(selectedSlots).forEach(([courtId, dateSlots]) => {
      const court = operatorCourts.find(c => c.id === courtId);
      if (!court) return;

      Object.entries(dateSlots).forEach(([dateStr, rangeIds]) => {
        if (!Array.isArray(rangeIds)) return;
        const sortedRangeIds = [...rangeIds].sort(
          (a, b) => getRangeIndex(a) - getRangeIndex(b),
        );

        const ranges: Array<{ startSlot: TimeSlot; endSlot: TimeSlot; label: string; price: number }> = [];
        let courtDateTotalPrice = 0;

        sortedRangeIds.forEach((rangeId) => {
          const rangeIndex = parseInt(rangeId.replace('range-', '').split('-')[0]);
          if (rangeIndex >= 0 && rangeIndex < court.availableSlots.length - 1) {
            const startSlot = court.availableSlots[rangeIndex];
            const endSlot = court.availableSlots[rangeIndex + 1];
            ranges.push({
              startSlot,
              endSlot,
              label: formatTimeRangeLabel(startSlot.time, endSlot.time),
              price: startSlot.price,
            });
            courtDateTotalPrice += startSlot.price;
          }
        });

        if (ranges.length > 0) {
          bookingsByCourtAndDate.push({
            court,
            date: dateStr,
            ranges,
            totalPrice: courtDateTotalPrice,
            totalHours: ranges.length,
          });
          grandTotalPrice += courtDateTotalPrice;
          grandTotalHours += ranges.length;
        }
      });
    });

    return { bookingsByCourtAndDate, grandTotalPrice, grandTotalHours };
  };

  const handleFloatingPanelClick = () => {
    if (!totals.hasSelections) return;
    setIsFloatingExpanded((prev) => !prev);
  };

  const handleClearAllSlots = () => {
    setSelectedSlots({});
    setIsFloatingExpanded(false);
  };

  const handleSummaryConfirm = () => {
    const { bookingsByCourtAndDate } = calculateBookingDetails();
    bookingsByCourtAndDate.forEach(({ court, ranges, date }) => {
      if (ranges.length > 0) {
        const existingCourt = mockCourts.find((item) => item.id === court.id);
        if (existingCourt) {
          Object.assign(existingCourt, {
            ...court,
            availableSlots: court.availableSlots,
          });
        } else {
          mockCourts.push({ ...court });
        }
        const firstSlot = ranges[0].startSlot;
        const lastSlot = ranges[ranges.length - 1].endSlot;
        onAddToCart(firstSlot, lastSlot, court.id, new Date(date));
      }
    });
    // Clear selections after adding to cart
    setSelectedSlots({});
    setIsSummaryModalOpen(false);
  };

  const handleSummaryPayNow = () => {
    const { bookingsByCourtAndDate } = calculateBookingDetails();
    bookingsByCourtAndDate.forEach(({ court, ranges, date }) => {
      if (ranges.length > 0) {
        const existingCourt = mockCourts.find((item) => item.id === court.id);
        if (existingCourt) {
          Object.assign(existingCourt, {
            ...court,
            availableSlots: court.availableSlots,
          });
        } else {
          mockCourts.push({ ...court });
        }
        const firstSlot = ranges[0].startSlot;
        const lastSlot = ranges[ranges.length - 1].endSlot;
        onPayNow(firstSlot, lastSlot, court.id, new Date(date));
      }
    });
    // Clear selections after payment
    setSelectedSlots({});
    setIsSummaryModalOpen(false);
  };

  const handleBookCourt = (court: Court, rangeId?: string) => {
    const hydratedCourt: Court = {
      ...court,
      operatorId:
        court.operatorId ??
        operator?.id ??
        resolvedOperatorId ??
        'venue',
      operatorName: court.operatorName ?? operator?.name ?? 'Venue',
      location: court.location ?? operator?.location ?? '',
      city: court.city ?? operator?.city ?? '',
    };

    if (
      !requireAuth(
        () => {
          setSelectedCourt(hydratedCourt);
          setPreselectedTimeSlot(rangeId || null);
          setIsBookingModalOpen(true);
        },
        { runAfterLogin: false },
      )
    ) {
      return;
    }
    setSelectedCourt(hydratedCourt);
    setPreselectedTimeSlot(rangeId || null);
    setIsBookingModalOpen(true);
  };

  const handleAddToCartFromModal = (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot) => {
    if (selectedCourt) {
      const existingCourt = mockCourts.find((court) => court.id === selectedCourt.id);
      if (existingCourt) {
        Object.assign(existingCourt, {
          ...selectedCourt,
          availableSlots: selectedCourt.availableSlots,
        });
      } else {
        mockCourts.push({ ...selectedCourt });
      }
      onAddToCart(timeSlotFrom, timeSlotTo, selectedCourt.id, selectedDates[0] ?? new Date());
    }
  };

  const handlePayNowFromModal = (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot) => {
    if (selectedCourt) {
      onPayNow(timeSlotFrom, timeSlotTo, selectedCourt.id, selectedDates[0] ?? new Date());
    }
  };

  const getTimeGroup = (
    timeLabel: string,
  ): '' | 'Morning' | 'Afternoon' | 'Evening' => {
    const parsedTime = parse(timeLabel, 'h:mm a', new Date());
    if (Number.isNaN(parsedTime.getTime())) {
      return 'Morning';
    }
    const hour = parsedTime.getHours();
    if (hour < 6) return '';
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDates([newDate]);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: operator.name,
      text: `Check out ${operator.name} - ${operator.location}`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      // Handle errors silently for user cancellations
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled the share, do nothing
        return;
      }
    }

    // Fallback: Try multiple clipboard methods
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
        return;
      }
    } catch (clipboardErr) {
      // Clipboard API failed, try legacy method
    }

    // Legacy fallback using execCommand
    try {
      const textArea = document.createElement('textarea');
      textArea.value = window.location.href;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        alert('Link copied to clipboard!');
      } else {
        throw new Error('execCommand failed');
      }
    } catch (err) {
      // All methods failed, show the URL for manual copying
      prompt('Copy this link to share:', window.location.href);
    }
  };

  const handleBackNavigation = () => {
    const historyStateIdx =
      typeof window !== 'undefined' && typeof window.history.state?.idx === 'number'
        ? window.history.state.idx
        : 0;

    if (historyStateIdx > 0 || (typeof window !== 'undefined' && window.history.length > 1)) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  const renderCourt = (court: Court) => {
    // Generate time ranges for this court
    const timeRanges: Array<{
      id: string;
      startSlot: TimeSlot;
      endSlot: TimeSlot;
      label: string;
      available: boolean;
      price: number;
    }> = [];
    for (let i = 0; i < court.availableSlots.length - 1; i++) {
      const startSlot = court.availableSlots[i];
      const endSlot = court.availableSlots[i + 1];
      timeRanges.push({
        id: `range-${i}`,
        startSlot,
        endSlot,
        label: formatTimeRangeLabel(startSlot.time, endSlot.time),
        available: startSlot.available,
        price: startSlot.price,
      });
    }

    const availableSlotsCount = timeRanges.filter(
      (range) => range.available,
    ).length;
    const selectedCountForCourt = Object.values(
      selectedSlots[court.id] ?? {},
    ).reduce((total, slots) => total + slots.length, 0);
    const cartLabelsByDate = new Map<string, Set<string>>();
    const normalizedCourtId = normalizeText(court.id);
    const normalizedCourtName = normalizeText(court.name);
    const normalizedOperatorId = normalizeVenueKey(
      court.operatorId,
    );
    const normalizedOperatorName = normalizeText(
      court.operatorName,
    );
    cartItems.forEach((item) => {
      const itemCourtId = normalizeText(item.courtId);
      const itemCourtName = normalizeText(item.courtName);
      const itemOperatorId = normalizeVenueKey(item.operatorId);
      const itemOperatorName = normalizeText(item.operatorName);
      const isSameCourtById =
        normalizedCourtId.length > 0 &&
        itemCourtId.length > 0 &&
        itemCourtId === normalizedCourtId;
      const isSameCourtByName =
        normalizedCourtName.length > 0 &&
        itemCourtName.length > 0 &&
        itemCourtName === normalizedCourtName &&
        ((normalizedOperatorId.length > 0 &&
          itemOperatorId.length > 0 &&
          itemOperatorId === normalizedOperatorId) ||
          (normalizedOperatorName.length > 0 &&
            itemOperatorName.length > 0 &&
            itemOperatorName === normalizedOperatorName));
      if (!isSameCourtById && !isSameCourtByName) return;
      const itemDate =
        item.date instanceof Date
          ? item.date
          : new Date(item.date);
      if (Number.isNaN(itemDate.getTime())) return;
      const dateKey = format(itemDate, 'yyyy-MM-dd');
      if (!cartLabelsByDate.has(dateKey)) {
        cartLabelsByDate.set(dateKey, new Set<string>());
      }
      item.timeSlots?.forEach((slotLabel) => {
        if (slotLabel) {
          cartLabelsByDate.get(dateKey)?.add(slotLabel);
        }
      });
    });

    const rawPurpose = String(
      court.purpose ?? court.type ?? 'Others',
    );
    const purposeKey =
      rawPurpose
        .toLowerCase()
        .replace(/\bcourts?\b/g, '')
        .replace(/\s+/g, ' ')
        .trim() || 'others';
    const purposeText =
      purposeKey.charAt(0).toUpperCase() + purposeKey.slice(1);
    const purposeIcon = courtTypeIcons[purposeKey];

    const isCourtExpanded = expandedCourtId === court.id;

    return (
      <div
        key={court.id}
        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        {/* Court Header – Accordion Toggle */}
        <button
          type="button"
          onClick={() => {
            // On mobile, open booking modal; on desktop, toggle accordion
            if (window.innerWidth < 768) {
              handleBookCourt(court);
            } else {
              setExpandedCourtId(prev => (prev === court.id ? null : court.id));
            }
          }}
          className="w-full bg-white py-3 sm:py-4 px-5 sm:px-4 border-0 md:border-b md:border-gray-200 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 flex items-center justify-center shrink-0"
              >
                {(purposeKey === 'pickleball' || purposeKey === 'pickle') ? (
                  <Icons.pickleball className="size-7 text-gray-900" />
                ) : purposeIcon && (
                  <img
                    src={purposeIcon}
                    alt={`${purposeText} icon`}
                    className="size-7"
                    loading="lazy"
                  />
                )}
              </div>
              <div>
                <h3 className="font-medium text-sm truncate">
                  {purposeText} {court.name}
                </h3>
                <p className="mt-[2px] text-xs text-gray-500">
                  {availableSlotsCount} slot{availableSlotsCount !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
            <ChevronDown
              className={`hidden md:block size-5 text-gray-400 transition-transform duration-200 shrink-0 ${isCourtExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Time Slots – Accordion Body */}
        {isCourtExpanded && (
          <div className="hidden md:block p-4">
            {selectedDates
              .sort((a, b) => a.getTime() - b.getTime())
              .map((date, dateIndex) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return (
                  <div
                    key={dateStr}
                    className={
                      dateIndex > 0
                        ? 'mt-4 pt-4 border-t border-gray-200'
                        : ''
                    }
                  >
                    {selectedDates.length > 1 && (
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        {format(date, 'EEE, MMM dd')}
                      </h4>
                    )}
                    <div className="space-y-4">
                      {(
                        ['', 'Morning', 'Afternoon', 'Evening'] as const
                      ).map((label, labelIndex) => {
                        const groupedRanges = timeRanges.filter(
                          (range) =>
                            getTimeGroup(range.startSlot.time) ===
                            label,
                        );
                        if (groupedRanges.length === 0) {
                          return null;
                        }
                        return (
                          <div
                            key={`${dateStr}-${label}`}
                            className={`space-y-2 ${labelIndex > 0 ? 'pt-3' : ''}`}
                          >
                            {label ? (
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                {label}
                              </div>
                            ) : null}
                            <div className="grid grid-cols-1 gap-2">
                              {groupedRanges.map((range) => {
                                const isAlreadyInCart =
                                  cartLabelsByDate
                                    .get(dateStr)
                                    ?.has(range.label) ?? false;
                                const isSelected =
                                  isAlreadyInCart ||
                                  selectedSlots[court.id]?.[
                                    dateStr
                                  ]?.includes(range.id);
                                const isLimitReached =
                                  !isAlreadyInCart &&
                                  !selectedSlots[court.id]?.[
                                    dateStr
                                  ]?.includes(range.id) &&
                                  selectedCountForCourt >=
                                  selectionLimit;

                                return (
                                  <button
                                    key={`${dateStr}-${range.id}`}
                                    onClick={() => {
                                      if (isAlreadyInCart) {
                                        toast.info(
                                          'Already added to cart',
                                          {
                                            description:
                                              'Check your cart to manage this slot.',
                                          },
                                        );
                                        return;
                                      }
                                      if (range.available) {
                                        toggleTimeSlot(
                                          court.id,
                                          dateStr,
                                          range.id,
                                        );
                                      }
                                    }}
                                    disabled={
                                      (!range.available &&
                                        !isAlreadyInCart) ||
                                      isLimitReached
                                    }
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${isSelected
                                      ? 'bg-gray-900 text-white'
                                      : !range.available ||
                                        isLimitReached
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-gray-50 hover:bg-gray-100'
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {isSelected ? (
                                        <Check className="size-4 flex-shrink-0" />
                                      ) : (
                                        <DynamicClock
                                          time={
                                            range.startSlot.time
                                          }
                                          className="size-4 flex-shrink-0"
                                        />
                                      )}
                                      <span className="font-medium whitespace-nowrap">
                                        {range.label}
                                      </span>
                                    </div>
                                    {(range.available ||
                                      isAlreadyInCart) && (
                                        <span className={`font-semibold ${isSelected ? 'text-white' : ''}`}>
                                          ₱{formatCurrency(range.price)}
                                        </span>
                                      )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative -mx-4 sm:mx-0 h-64 overflow-hidden sm:h-90 mt-0 sm:mt-6 md:mt-8 rounded-none sm:rounded-lg">
        <ImageWithFallback
          src={operator.image}
          alt={`${operator.name} banner`}
          className="absolute inset-0 h-full w-full object-cover "
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        <div className="relative h-full flex flex-col justify-end pb-8">
          <Button
            variant="ghost"
            onClick={handleBackNavigation}
            className="absolute top-4 left-4 text-white hover:bg-white/20"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </Button>

          {/* Share and Bookmark Buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="bg-black/30 backdrop-blur-sm rounded-full p-3 flex items-center justify-center shadow-md hover:bg-black/40 transition-colors"
              aria-label="Share"
            >
              <Share2 className="size-5 text-white" />
            </button>

            {/* Bookmark Button */}
            <button
              onClick={() => onToggleBookmark(operator.id, operator)}
              className="bg-black/30 backdrop-blur-sm rounded-full p-3 flex items-center justify-center shadow-md hover:bg-black/40 transition-colors"
              aria-label="Bookmark"
            >
              <Bookmark
                className={`size-5 ${bookmarkedOperatorIds.includes(operator.id) ? 'fill-[#C8F542] text-[#C8F542]' : 'text-white'}`}
              />
            </button>
          </div>

          <div className="text-white flex flex-col items-center text-center">
            {/* Profile Image */}
            {operator.profileImage && (
              <div className="relative mb-3">
                <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-35 lg:h-35 rounded-full overflow-hidden border-4 border-gray/10 shadow-xl">
                  <ImageWithFallback
                    src={operator.profileImage}
                    alt={`${operator.name} profile`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            <div>
              {/* Covered Pill Badge */}
              {operator.isCovered && (
                <div className="flex justify-center mb-2">
                  <span className="inline-block bg-[#C8E64A] px-3 py-0.5 mt-1 mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-900">
                    Covered
                  </span>
                </div>
              )}
              <h1
                className="text-4xl sm:text-3xl lg:text-5xl font-bold mb-1 font-bebas uppercase"
                style={{ letterSpacing: '0.04em' }}
              >
                {operator.name}
              </h1>
              <div className="flex items-center justify-center gap-2 text-sm sm:text-base lg:text-lg min-w-0 opacity-60">
                <MapPin className="size-4 sm:size-5 shrink-0" />
                <span className="block max-w-[80vw] truncate sm:max-w-[70vw] lg:max-w-[36rem]">
                  {operator.location}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={mobileDateSentinelRef}
        className="h-px sm:hidden"
        aria-hidden="true"
      />

      <section
        ref={mobileDateBarRef}
        className={`sticky top-0 z-[1100] px-1 py-3 backdrop-blur-sm sm:hidden overflow-visible border-b ${isMobileDateBarPinned
          ? 'border-neutral-800 bg-neutral-950/95'
          : 'border-gray-200 bg-gradient-to-b from-gray-100/95 to-white/95'
          }`}
      >
        <div className="relative w-full">
          <div className="px-2 flex items-center gap-2">
            <Popover
              open={isMobileDatePickerOpen}
              onOpenChange={setIsMobileDatePickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`!h-10 !min-h-[40px] !max-h-[40px] !w-auto justify-start rounded-md border-0 px-3 text-left text-sm font-medium shadow-none ${isMobileDateBarPinned
                    ? 'bg-transparent text-white'
                    : 'bg-transparent text-gray-900'
                    }`}
                >
                  <Calendar
                    className={`mr-0.5 size-4 ${isMobileDateBarPinned ? 'text-white/85' : 'text-gray-700'
                      }`}
                  />
                  <span className="truncate">
                    {renderDateLabel(selectedDates[0])}
                  </span>
                  <ChevronDown
                    className={`ml-auto size-4 ${isMobileDateBarPinned ? 'text-white/70' : 'text-gray-500'
                      }`}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="z-[1400] w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDates[0]}
                  onSelect={(date) => {
                    if (!date) return
                    setSelectedDates([date])
                    setIsMobileDatePickerOpen(false)
                  }}
                  disabled={{ before: getMinimumBookableDate() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {operator.phone ? (
              <a
                href={`tel:${operator.phone}`}
                className={`ml-auto mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${isMobileDateBarPinned
                  ? 'border-white/20 text-white/85 hover:bg-white/10'
                  : 'border-white/80 bg-white/80 text-gray-700 hover:bg-gray-50'
                  }`}
                aria-label={`Call ${operator.name}`}
                title={`Call ${operator.name}`}
              >
                <Phone className="size-4" />
              </a>
            ) : (operator.websiteUrl || operator.socialMedia?.facebook) ? (
              <a
                href={operator.websiteUrl || operator.socialMedia?.facebook}
                target="_blank"
                rel="noreferrer"
                className={`ml-auto mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${isMobileDateBarPinned
                  ? 'border-white/20 text-white/85 hover:bg-white/10'
                  : 'border-white/80 bg-white/80 text-gray-700 hover:bg-gray-50'
                  }`}
                aria-label={`Open ${operator.name} link`}
                title={`Open ${operator.name} link`}
              >
                <Globe className="size-4" />
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="pt-6 pb-0 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
          {/* Left Column - Facility Info */}
          <div className="lg:col-span-1 order-2 lg:order-1 -mx-4 sm:mx-0 mb-0 sm:mb-6 md:mb-8">
            <div className="bg-white rounded-none sm:rounded-lg border-0 shadow-none sm:shadow-sm p-6 space-y-6 lg:sticky lg:top-4">
              <div>
                <h2 className="text-base sm:text-lg font-medium mb-3">
                  About
                </h2>
                <p className="text-gray-600 text-sm lg:text-base">
                  {operator.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-medium mb-3">
                  Location
                </h3>
                <div className="relative rounded-lg overflow-hidden border border-gray-200">
                  <VenueMapView
                    center={operator.coordinates}
                    venues={[
                      {
                        operatorId: operator.id,
                        operatorName: operator.name,
                        coordinates: operator.coordinates,
                      },
                    ]}
                    onCenterChange={() => { }}
                    onVenueClick={() => setIsMapModalOpen(true)}
                    showDragHint={false}
                    heightClassName="h-[250px]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="absolute inset-0 z-10"
                    aria-label="Open larger map"
                  />
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-600">
                  <MapPin className="size-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{operator.location}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base font-medium mb-3">
                  Contact
                </h3>
                <div className="space-y-3">
                  {operator.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="size-4 text-gray-500" />
                      <a
                        href={`tel:${operator.phone}`}
                        className="text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        {operator.phone}
                      </a>
                    </div>
                  )}
                  {operator.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="size-4 text-gray-500" />
                      <a
                        href={`mailto:${operator.email}`}
                        className="text-gray-700 hover:text-gray-900 hover:underline"
                      >
                        {operator.email}
                      </a>
                    </div>
                  )}
                  {operator.operatingHours?.trim() && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="size-4 text-gray-500" />
                      <span className="text-gray-700">
                        {operator.operatingHours}
                      </span>
                    </div>
                  )}
                  {operator.websiteUrl && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="size-4 text-gray-500" />
                      <a
                        href={operator.websiteUrl}
                        className="min-w-0 flex-1 truncate text-gray-700 hover:text-gray-900 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        title={operator.websiteUrl}
                      >
                        {operator.websiteUrl.replace(/^https?:\/\//i, '')}
                      </a>
                    </div>
                  )}
                  {operator.socialMedia && (
                    <div className="space-y-3">
                      {operator.socialMedia.facebook && (
                        <div className="flex items-center gap-3 text-sm">
                          <Facebook className="size-4 text-gray-500" />
                          <a
                            href={operator.socialMedia.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-gray-700 hover:text-gray-900 hover:underline"
                            title={operator.socialMedia.facebook}
                          >
                            {operator.socialMedia.facebook.replace(
                              /^https?:\/\//i,
                              '',
                            )}
                          </a>
                        </div>
                      )}
                      {operator.socialMedia.instagram && (
                        <div className="flex items-center gap-3 text-sm">
                          <Instagram className="size-4 text-gray-500" />
                          <a
                            href={operator.socialMedia.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-gray-700 hover:text-gray-900 hover:underline"
                            title={operator.socialMedia.instagram}
                          >
                            {operator.socialMedia.instagram.replace(
                              /^https?:\/\//i,
                              '',
                            )}
                          </a>
                        </div>
                      )}
                      {operator.socialMedia.twitter && (
                        <div className="flex items-center gap-3 text-sm">
                          <Twitter className="size-4 text-gray-500" />
                          <a
                            href={operator.socialMedia.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-gray-700 hover:text-gray-900 hover:underline"
                            title={operator.socialMedia.twitter}
                          >
                            {operator.socialMedia.twitter.replace(
                              /^https?:\/\//i,
                              '',
                            )}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {operator.amenities && operator.amenities.length > 0 && (
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {operator.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="inline-block rounded-full bg-gray-900 px-3.5 py-1.5 text-xs font-medium text-white"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Courts */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="hidden sm:flex items-center justify-between mb-5">
              {/* Available Courts Header */}
              <div>
                <h2 className="text-sm sm:text-base font-medium">Available Courts</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {operatorCourts.length} court{operatorCourts.length !== 1 ? 's' : ''}
                  {' · '}
                  {operatorCourts.reduce((total, court) => total + court.availableSlots.filter(s => s.available).length, 0)} total slots
                </p>
              </div>

              {/* Date Filter */}
              <Popover
                open={isDesktopDatePickerOpen}
                onOpenChange={setIsDesktopDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 h-9 px-3 text-xs justify-start"
                  >
                    <Calendar className="size-3.5" />
                    <span className="truncate">{renderDateLabel(selectedDates[0])}</span>
                    <ChevronDown className="ml-1 size-3.5 text-gray-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDates[0]}
                    onSelect={(date) => {
                      if (!date) return;
                      setSelectedDates([date]);
                      setIsDesktopDatePickerOpen(false);
                    }}
                    disabled={{ before: getMinimumBookableDate() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {isLoadingCourts && operatorCourts.length === 0 ? (
              <div className="-mx-4 sm:mx-0 overflow-hidden rounded-none sm:rounded-lg border-0 bg-white shadow-none sm:shadow-sm md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:bg-transparent lg:gap-6 lg:border-0 lg:shadow-none lg:rounded-none">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`court-skeleton-${index}`}
                    className="overflow-hidden border-b border-gray-100 last:border-b-0 md:rounded-lg md:border md:border-gray-200 md:bg-white md:shadow-sm"
                  >
                    <div className="bg-white py-3 px-4 md:bg-gradient-to-b md:from-gray-100 md:to-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                          <div className="space-y-2">
                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                          </div>
                        </div>
                        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="hidden md:block p-4 space-y-2">
                      <div className="h-9 w-full bg-gray-200 rounded animate-pulse" />
                      <div className="h-9 w-full bg-gray-200 rounded animate-pulse" />
                      <div className="h-9 w-full bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : operatorCourts.length > 0 ? (
              <div
                className={`transition-opacity duration-200 ${isLoadingCourts ? 'opacity-45 pointer-events-none' : 'opacity-100'
                  }`}
              >
                {/* Mobile View: Single Column Stacking */}
                <div className="flex flex-col gap-4 sm:hidden">
                  {operatorCourts.map((court) => renderCourt(court))}
                </div>

                {/* Desktop View: Independent Columns Split */}
                <div className="hidden sm:grid sm:grid-cols-2 sm:gap-4 md:gap-5 lg:gap-6 items-start">
                  <div className="flex flex-col gap-4 md:gap-5 lg:gap-6">
                    {operatorCourts
                      .filter((_, index) => index % 2 === 0)
                      .map((court) => renderCourt(court))}
                  </div>
                  <div className="flex flex-col gap-4 md:gap-5 lg:gap-6">
                    {operatorCourts
                      .filter((_, index) => index % 2 !== 0)
                      .map((court) => renderCourt(court))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-500 text-sm sm:text-base">
                  No courts available at this facility
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <BookingModal
        court={selectedCourt}
        date={selectedDates[0]}
        timeFrom="All Times"
        timeTo="All Times"
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false)
          setPreselectedTimeSlot(null)
        }}
        onConfirm={handleAddToCartFromModal}
        onPayNow={handlePayNowFromModal}
        onDateChange={(nextDate) => setSelectedDates([nextDate])}
        isLoadingSlots={isLoadingCourts}
        preselectedSlotId={preselectedTimeSlot}
        hasPendingBookings={hasPendingBookings}
        cartItems={cartItems}
      />

      {/* Booking Summary Modal */}
      <BookingSummaryModal
        bookingsByCourtAndDate={
          calculateBookingDetails().bookingsByCourtAndDate
        }
        grandTotalPrice={calculateBookingDetails().grandTotalPrice}
        grandTotalHours={calculateBookingDetails().grandTotalHours}
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        onConfirm={handleSummaryConfirm}
        onPayNow={handleSummaryPayNow}
        showAddToCart={true}
      />

      <Dialog open={isMapModalOpen} onOpenChange={setIsMapModalOpen}>
        <DialogContent className="max-w-5xl w-[96vw] p-0 gap-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <DialogHeader className="pt-1">
              <DialogTitle>{operator.name}</DialogTitle>
            </DialogHeader>
            <div className="pr-8" />
          </div>
          <div className="relative">
            <VenueMapView
              center={operator.coordinates}
              venues={[
                {
                  operatorId: operator.id,
                  operatorName: operator.name,
                  coordinates: operator.coordinates,
                },
              ]}
              onCenterChange={() => { }}
              onVenueClick={() => { }}
              showDragHint={false}
              heightClassName="h-[75vh]"
              initialZoom={16}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[1200] flex justify-center">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="pointer-events-auto inline-flex items-center rounded-md bg-black/90 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-black"
              >
                Open Google Maps
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Cart Pill / Expanded Summary */}
      {totals.hasSelections && (
        <div className="hidden md:flex flex-col items-end fixed bottom-6 right-6 z-50">
          {/* Expanded Booking Summary */}
          {isFloatingExpanded && (
            <div className="mb-3 w-[380px] rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-gray-900 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-bold text-white" style={{ fontFamily: "'Alegreya Sans', sans-serif" }}>Booking Summary</span>
                  <span className="flex items-center justify-center size-6 rounded-full bg-[#C8F542] text-[11px] font-bold text-gray-900">
                    {totals.totalHours}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClearAllSlots(); }}
                    className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setIsFloatingExpanded(false)}
                    className="p-0.5 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className="size-5" />
                  </button>
                </div>
              </div>

              {/* Slot List */}
              <div className="border-t border-gray-100 px-5 py-3 space-y-1 max-h-[240px] overflow-y-auto">
                {(() => {
                  const details = calculateBookingDetails();
                  return details.bookingsByCourtAndDate.flatMap((group) =>
                    group.ranges.map((range, rangeIdx) => (
                      <div
                        key={`${group.court.id}-${group.date}-${rangeIdx}`}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-9 rounded-lg bg-gray-900">
                            <Clock className="size-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{range.label}</p>
                            <p className="text-[11px] text-gray-500">
                              {(group.court.purpose ?? group.court.type ?? 'Court').charAt(0).toUpperCase() + (group.court.purpose ?? group.court.type ?? 'Court').slice(1)} {group.court.name}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-gray-900">₱{formatCurrency(range.price)}</span>
                      </div>
                    ))
                  );
                })()}
              </div>

              {/* Footer: Total + Book */}
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-gray-400">Total · {totals.totalHours} slot{totals.totalHours !== 1 ? 's' : ''}</p>
                  <p className="text-lg font-bold text-gray-900">₱{formatCurrency(totals.totalPrice)}</p>
                </div>
                <button
                  onClick={() => { setIsFloatingExpanded(false); setIsSummaryModalOpen(true); }}
                  className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Book
                </button>
              </div>
            </div>
          )}

          {/* Collapsed Pill - hidden when expanded */}
          {!isFloatingExpanded && (
          <button
            onClick={handleFloatingPanelClick}
            className="flex items-center gap-3 bg-gray-900 text-white rounded-full shadow-2xl pl-4 pr-3 py-3 transition-all cursor-pointer"
          >
            <div className="relative flex items-center justify-center size-10 rounded-full bg-[#C8F542]">
              <Icons.cart className="size-5 text-gray-900" />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center size-5 rounded-full bg-white ring-2 ring-gray-900 text-[10px] font-bold text-gray-900">
                {totals.totalHours}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">₱{formatCurrency(totals.totalPrice)}</span>
              <span className="text-sm text-gray-400">{totals.totalHours} slot{totals.totalHours !== 1 ? 's' : ''} · View</span>
            </div>
            <ChevronDown className={`size-4 text-gray-400 transition-transform ${isFloatingExpanded ? '' : 'rotate-180'}`} />
          </button>
          )}
        </div>
      )}
    </div>
  )
}
