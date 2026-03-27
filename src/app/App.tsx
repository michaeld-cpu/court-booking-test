import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
const OperatorPage = React.lazy(() => import('./pages/OperatorPage').then(module => ({ default: module.OperatorPage })));
const MyBookings = React.lazy(() => import('./pages/MyBookings').then(module => ({ default: module.MyBookings })));
const MyBookmarks = React.lazy(() => import('./pages/MyBookmarks').then(module => ({ default: module.MyBookmarks })));
const ContactUs = React.lazy(() => import('./pages/ContactUs').then(module => ({ default: module.ContactUs })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then(module => ({ default: module.TermsPage })));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then(module => ({ default: module.PrivacyPage })));
const PaymentSuccess = React.lazy(() => import('./pages/PaymentSuccess').then(module => ({ default: module.PaymentSuccess })));
const PaymentFailed = React.lazy(() => import('./pages/PaymentFailed').then(module => ({ default: module.PaymentFailed })));
const PaymentCancelled = React.lazy(() => import('./pages/PaymentCancelled').then(module => ({ default: module.PaymentCancelled })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })));
const ServerErrorPage = React.lazy(() => import('./pages/ServerErrorPage').then(module => ({ default: module.ServerErrorPage })));

import { Cart } from './components/Cart';
import { BookingSummaryModal } from './components/BookingSummaryModal';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { ProtectedRoute } from './components/ProtectedRoute';

import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { mockCourts } from './data/mockData';
import { TimeSlot, Booking, CartItem, Court, Operator } from './types';
import { toast } from '@/app/lib/toast';
import { Toaster } from './components/ui/toaster';
import { ShoppingCart } from 'lucide-react';
import { Button } from './components/ui/button';
import { formatTimeRangeLabel } from './lib/timeFormat';
import { api } from './lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog';

function ErrorBoundaryTestPage() {
  throw new Error('Intentional error boundary test');
  return null;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function AppContent() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const defaultHomeTitle = "Korte.ph - Easy Court Booking";
  useIsomorphicLayoutEffect(() => {
    // Ensure top reset across browsers/containers on every route change.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);
  useEffect(() => {
    const { pathname } = location;

    if (pathname === '/') {
      document.title = defaultHomeTitle;
      return;
    }

    if (pathname.startsWith('/operator/') || pathname.startsWith('/venue/')) {
      // Handled dynamically in OperatorPage using venue/operator name.
      return;
    }

    if (pathname === '/bookings') {
      document.title = 'My Bookings | Korte.ph';
      return;
    }
    if (pathname === '/bookmarks') {
      document.title = 'My Saved | Korte.ph';
      return;
    }
    if (pathname === '/contact-us') {
      document.title = 'Contact Us | Korte.ph';
      return;
    }
    if (pathname === '/terms') {
      document.title = 'Terms of Service | Korte.ph';
      return;
    }
    if (pathname === '/privacy') {
      document.title = 'Privacy Policy | Korte.ph';
      return;
    }
    if (pathname === '/payment/successful') {
      document.title = 'Payment Successful | Korte.ph';
      return;
    }
    if (pathname === '/payment/failed') {
      document.title = 'Payment Failed | Korte.ph';
      return;
    }
    if (pathname === '/payment/cancelled') {
      document.title = 'Payment Cancelled | Korte.ph';
      return;
    }
    if (pathname === '/500') {
      document.title = 'Server Error | Korte.ph';
      return;
    }
    document.title = 'Page Not Found | Korte.ph';
  }, [location.pathname, defaultHomeTitle]);
  useEffect(() => {
    const handleLogoutRedirect = () => {
      navigate('/', { replace: true });
    };

    window.addEventListener('courtbook:logout', handleLogoutRedirect);
    return () => {
      window.removeEventListener('courtbook:logout', handleLogoutRedirect);
    };
  }, [navigate]);
  const isPaymentRoute = location.pathname.startsWith('/payment/');
  const isProtectedRoute =
    location.pathname === '/bookings' || location.pathname === '/bookmarks';
  const isLoginRequired = isProtectedRoute && !isAuthenticated;
  const hideFooterRoutes = isPaymentRoute || isLoginRequired;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookmarkedOperatorIds, setBookmarkedOperatorIds] = useState<string[]>([]);
  const [bookmarkedOperators, setBookmarkedOperators] = useState<Operator[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Close the cart on mobile when navigating, since it takes up the full screen
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsCartOpen(false);
    }
  }, [location.pathname]);

  const [isCartSummaryOpen, setIsCartSummaryOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isVenueLimitOpen, setIsVenueLimitOpen] = useState(false);
  const [isHomeAvailabilityReady, setIsHomeAvailabilityReady] = useState(false);
  const [hasFetchedPendingBookings, setHasFetchedPendingBookings] = useState(false);
  const [hasPendingBookings, setHasPendingBookings] = useState(false);
  const [hasConfirmedBookings, setHasConfirmedBookings] = useState(false);
  const [isHomeEmpty, setIsHomeEmpty] = useState(false);
  const hideFooterOnMobile =
    (location.pathname === '/bookings' && bookings.length === 0) ||
    (location.pathname === '/bookmarks' && bookmarkedOperatorIds.length === 0);
  const hideFooterForHomeEmptyOnMobile = location.pathname === '/' && isHomeEmpty;
  const bookmarksStorageKey = 'courtbook_bookmarked_operator_ids';
  const bookmarkedOperatorsStorageKey = 'courtbook_bookmarked_operators';

  useEffect(() => {
    try {
      const storedIds = localStorage.getItem(bookmarksStorageKey);
      const storedOperators = localStorage.getItem(bookmarkedOperatorsStorageKey);
      const parsedIds = storedIds ? JSON.parse(storedIds) : [];
      const parsedOperators = storedOperators ? JSON.parse(storedOperators) : [];
      if (Array.isArray(parsedIds)) {
        setBookmarkedOperatorIds(parsedIds);
      }
      if (Array.isArray(parsedOperators)) {
        setBookmarkedOperators(parsedOperators);
      }
    } catch {
      setBookmarkedOperatorIds([]);
      setBookmarkedOperators([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(bookmarksStorageKey, JSON.stringify(bookmarkedOperatorIds));
    localStorage.setItem(bookmarkedOperatorsStorageKey, JSON.stringify(bookmarkedOperators));
  }, [bookmarkedOperatorIds, bookmarkedOperators]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }
    setHasFetchedPendingBookings(false);
    setHasPendingBookings(false);
    setHasConfirmedBookings(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isHomeAvailabilityReady || hasFetchedPendingBookings) {
      return;
    }

    let isActive = true;
    const hasUpcomingConfirmedBooking = (item: any) => {
      const status = String(
        item?.status ?? item?.booking_status ?? item?.state ?? ''
      ).toLowerCase();
      if (status !== 'confirmed') {
        return false;
      }

      const slotEndTimes: number[] = (Array.isArray(item?.bookingCourts) ? item.bookingCourts : [])
        .flatMap((bookingCourt: any) =>
          Array.isArray(bookingCourt?.slots) ? bookingCourt.slots : []
        )
        .map((slot: any) => {
          const slotDate = String(slot?.date ?? '').trim();
          const slotEnd = String(slot?.end_time ?? slot?.start_time ?? '').trim();
          if (!slotDate || !slotEnd) {
            return Number.NaN;
          }
          const endAt = new Date(`${slotDate}T${slotEnd}`).getTime();
          return Number.isFinite(endAt) ? endAt : Number.NaN;
        })
        .filter((value: number) => Number.isFinite(value));

      if (slotEndTimes.length > 0) {
        return Math.max(...slotEndTimes) > Date.now();
      }

      const fallbackDate = new Date(
        item?.date ?? item?.play_date ?? item?.created_ts ?? ''
      ).getTime();
      return Number.isFinite(fallbackDate) ? fallbackDate > Date.now() : false;
    };

    const fetchPendingBookings = async () => {
      try {
        const response = await api.get('/api/bookings');
        const data = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        const hasPending = data.some((item: any) => {
          const status = String(
            item?.status ?? item?.booking_status ?? item?.state ?? ''
          ).toLowerCase();
          return status === 'pending';
        });
        const hasConfirmed = data.some((item: any) =>
          hasUpcomingConfirmedBooking(item)
        );
        if (isActive) {
          setHasPendingBookings(hasPending);
          setHasConfirmedBookings(hasConfirmed);
        }
      } catch {
        // Keep indicator off when background fetch fails.
        if (isActive) {
          setHasPendingBookings(false);
          setHasConfirmedBookings(false);
        }
      } finally {
        if (isActive) {
          setHasFetchedPendingBookings(true);
        }
      }
    };

    fetchPendingBookings();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, isHomeAvailabilityReady, hasFetchedPendingBookings]);

  useEffect(() => {
    if (!isCartOpen) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    window.history.pushState(
      { ...(window.history.state ?? {}), courtbookCartOpen: true },
      '',
      window.location.href,
    );

    const handlePopState = () => {
      setIsCartOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCartOpen]);

  const requireAuth = (
    action: () => void,
    options?: { runAfterLogin?: boolean },
  ) => {
    if (!isAuthenticated) {
      if (options?.runAfterLogin === false) {
        setPendingAction(null);
      } else {
        setPendingAction(() => action);
      }
      setIsLoginModalOpen(true);
      return false;
    }
    return true;
  };

  const handleLoginSuccess = (auth: {
    mobileNumber: string;
    token: string;
    name?: string | null;
    user?: { id: number; name: string; email: string | null; role: string | null } | null;
  }) => {
    login(auth);
    setIsLoginModalOpen(false);

    // Execute pending action if any
    const actionToRun = pendingAction;
    setPendingAction(null);
    if (actionToRun) {
      actionToRun();
    }
  };

  const handleCartClick = () => {
    if (!requireAuth(() => handleCartClick())) {
      return;
    }
    setIsCartOpen(true);
  };

  const getDateKey = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
      value.getDate(),
    ).padStart(2, '0')}`;
  const parseSlotLabel = (label: string) => {
    const [start = '', end = ''] = label.split(' - ');
    return { start: start.trim(), end: end.trim() };
  };

  const handleAddToCart = (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
    courtId: string,
    date: Date
  ) => {
    if (!requireAuth(() => handleAddToCart(timeSlotFrom, timeSlotTo, courtId, date))) {
      return;
    }
    if (hasPendingBookings) {
      toast.error('Action not allowed', {
        description:
          'You have a pending booking. Please complete payment before adding to cart.',
      });
      return;
    }

    const selectedCourt = mockCourts.find(c => c.id === courtId);
    if (!selectedCourt) return;

    if (cart.length > 0) {
      const normalizeVenueId = (value: string) =>
        String(value ?? '').trim().replace(/^venue-/i, '').toLowerCase();
      const normalizeVenueName = (value: string) =>
        String(value ?? '').trim().toLowerCase();
      const getVenueKey = (value: string) => {
        const normalized = normalizeVenueId(value);
        if (!normalized) return '';
        const numeric = normalized.match(/\d+/g);
        if (numeric && numeric.length > 0) {
          return numeric[numeric.length - 1];
        }
        return normalized.replace(/[^a-z0-9]/g, '');
      };

      const currentOperatorId = normalizeVenueId(selectedCourt.operatorId || '');
      const cartOperatorId = normalizeVenueId(cart[0]?.operatorId || '');
      const currentOperatorName = normalizeVenueName(selectedCourt.operatorName || '');
      const cartOperatorName = normalizeVenueName(cart[0]?.operatorName || '');
      const currentVenueKey = getVenueKey(currentOperatorId);
      const cartVenueKey = getVenueKey(cartOperatorId);

      const isSameVenueById =
        currentVenueKey.length > 0 &&
        cartVenueKey.length > 0 &&
        currentVenueKey === cartVenueKey;
      const isSameVenueByName =
        currentOperatorName.length > 0 &&
        cartOperatorName.length > 0 &&
        currentOperatorName === cartOperatorName;
      const isSameVenue = isSameVenueById || isSameVenueByName;

      if (!isSameVenue) {
        setIsVenueLimitOpen(true);
        return;
      }
    }

    const findSlotIndex = (slot: TimeSlot) => {
      const indexById = selectedCourt.availableSlots.findIndex(s => s.id === slot.id);
      if (indexById !== -1) {
        return indexById;
      }
      return selectedCourt.availableSlots.findIndex(s => s.time === slot.time);
    };

    const fromIndex = findSlotIndex(timeSlotFrom);
    const toIndex = findSlotIndex(timeSlotTo);
    let slotsInRange: TimeSlot[] = [];

    if (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex) {
      slotsInRange = selectedCourt.availableSlots.slice(fromIndex, toIndex);
    } else if (fromIndex !== -1) {
      slotsInRange = selectedCourt.availableSlots.slice(fromIndex, fromIndex + 1);
    }

    const totalPrice =
      slotsInRange.length > 0
        ? slotsInRange.reduce((sum, slot) => sum + slot.price, 0)
        : timeSlotFrom.price ?? 0;

    // Generate individual time slot labels
    const timeSlots: string[] = [];
    if (slotsInRange.length === 0) {
      timeSlots.push(formatTimeRangeLabel(timeSlotFrom.time, timeSlotTo.time));
    } else {
      const endSlot = selectedCourt.availableSlots[toIndex] ?? timeSlotTo;
      for (let i = 0; i < slotsInRange.length; i++) {
        const currentSlot = slotsInRange[i];
        const nextSlot = i < slotsInRange.length - 1 ? slotsInRange[i + 1] : endSlot;
        if (nextSlot) {
          timeSlots.push(formatTimeRangeLabel(currentSlot.time, nextSlot.time));
        }
      }
    }

    const newCartItem: CartItem = {
      id: `cart-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      courtType: selectedCourt.type,
      date,
      timeSlotFrom: timeSlotFrom.time,
      timeSlotTo: timeSlotTo.time,
      timeSlots: timeSlots,
      price: totalPrice,
      operatorName: selectedCourt.operatorName,
      operatorId: selectedCourt.operatorId,
    };

    setCart((prevCart) => {
      const newItemDateKey = getDateKey(newCartItem.date);
      const existingIndex = prevCart.findIndex(
        (item) =>
          item.courtId === newCartItem.courtId &&
          getDateKey(item.date) === newItemDateKey,
      );

      if (existingIndex === -1) {
        return [...prevCart, newCartItem];
      }

      const existingItem = prevCart[existingIndex];
      const mergedSlotSet = new Set<string>([
        ...(existingItem.timeSlots ?? []),
        ...newCartItem.timeSlots,
      ]);

      const slotOrder = new Map(
        selectedCourt.availableSlots.map((slot, index) => [slot.time, index]),
      );
      const mergedSlots = Array.from(mergedSlotSet).sort((a, b) => {
        const aStart = parseSlotLabel(a).start;
        const bStart = parseSlotLabel(b).start;
        const aIndex = slotOrder.get(aStart) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = slotOrder.get(bStart) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });

      const firstSlot = mergedSlots[0] ? parseSlotLabel(mergedSlots[0]) : null;
      const lastSlot = mergedSlots[mergedSlots.length - 1]
        ? parseSlotLabel(mergedSlots[mergedSlots.length - 1])
        : null;
      const totalPrice = mergedSlots.reduce((sum, label) => {
        const start = parseSlotLabel(label).start;
        const slot = selectedCourt.availableSlots.find((value) => value.time === start);
        if (slot) {
          return sum + slot.price;
        }
        return sum;
      }, 0);

      const mergedItem: CartItem = {
        ...existingItem,
        timeSlots: mergedSlots,
        timeSlotFrom: firstSlot?.start || existingItem.timeSlotFrom,
        timeSlotTo: lastSlot?.end || existingItem.timeSlotTo,
        price: totalPrice > 0 ? totalPrice : existingItem.price + newCartItem.price,
      };

      const next = [...prevCart];
      next[existingIndex] = mergedItem;
      return next;
    });

    toast.success('Added to cart!', {
      description: `${selectedCourt.name} added for ${formatTimeRangeLabel(
        timeSlotFrom.time,
        timeSlotTo.time
      )}`,
    });
  };

  const handlePayNow = (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
    courtId: string,
    date: Date
  ) => {
    if (!requireAuth(() => handlePayNow(timeSlotFrom, timeSlotTo, courtId, date))) {
      return;
    }

    const selectedCourt = mockCourts.find(c => c.id === courtId);
    if (!selectedCourt) return;

    const fromIndex = selectedCourt.availableSlots.findIndex(s => s.id === timeSlotFrom.id);
    const toIndex = selectedCourt.availableSlots.findIndex(s => s.id === timeSlotTo.id);
    const slotsInRange = selectedCourt.availableSlots.slice(fromIndex, toIndex);
    const totalPrice = slotsInRange.reduce((sum, slot) => sum + slot.price, 0);

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      courtId: selectedCourt.id,
      courtName: selectedCourt.name,
      courtType: selectedCourt.type,
      date: date.toISOString(),
      timeSlotFrom: timeSlotFrom.time,
      timeSlotTo: timeSlotTo.time,
      price: totalPrice,
      operatorId: selectedCourt.operatorId,
      operatorName: selectedCourt.operatorName,
      location: selectedCourt.location,
      city: selectedCourt.city,
    };

    setBookings([...bookings, newBooking]);

    toast.success('Booking confirmed -!', {
      description: `${selectedCourt.name} booked for ${formatTimeRangeLabel(
        timeSlotFrom.time,
        timeSlotTo.time
      )}`,
    });
  };

  const handleRemoveFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId));
  };

  const handleRemoveSlotFromCart = (cartItemId: string, slotLabel: string) => {
    setCart((prevCart) =>
      prevCart.flatMap((item) => {
        if (item.id !== cartItemId) {
          return [item];
        }

        const slotLabels =
          item.timeSlots && item.timeSlots.length > 0
            ? item.timeSlots
            : [formatTimeRangeLabel(item.timeSlotFrom, item.timeSlotTo)];
        const slotIndex = slotLabels.findIndex((label) => label === slotLabel);
        if (slotIndex === -1) {
          return [item];
        }

        const remainingSlots = slotLabels.filter((_, index) => index !== slotIndex);
        if (remainingSlots.length === 0) {
          return [];
        }

        const court = mockCourts.find((value) => value.id === item.courtId);
        const slotOrder = new Map(
          (court?.availableSlots ?? []).map((slot, index) => [slot.time, index]),
        );
        const sortedRemainingSlots = [...remainingSlots].sort((a, b) => {
          const aStart = parseSlotLabel(a).start;
          const bStart = parseSlotLabel(b).start;
          const aIndex = slotOrder.get(aStart) ?? Number.MAX_SAFE_INTEGER;
          const bIndex = slotOrder.get(bStart) ?? Number.MAX_SAFE_INTEGER;
          return aIndex - bIndex;
        });

        const firstSlot = parseSlotLabel(sortedRemainingSlots[0]);
        const lastSlot = parseSlotLabel(
          sortedRemainingSlots[sortedRemainingSlots.length - 1],
        );
        const fallbackPerSlotPrice =
          slotLabels.length > 0 ? item.price / slotLabels.length : item.price;
        const recalculatedPrice = sortedRemainingSlots.reduce((sum, label) => {
          const start = parseSlotLabel(label).start;
          const matchedSlot = court?.availableSlots.find((slot) => slot.time === start);
          return sum + (matchedSlot?.price ?? fallbackPerSlotPrice);
        }, 0);

        return [
          {
            ...item,
            timeSlots: sortedRemainingSlots,
            timeSlotFrom: firstSlot.start || item.timeSlotFrom,
            timeSlotTo: lastSlot.end || item.timeSlotTo,
            price: recalculatedPrice,
          },
        ];
      }),
    );
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (hasPendingBookings) {
      toast.error('Checkout blocked', {
        description:
          'You have a pending booking. Please complete payment before checkout.',
      });
      return;
    }

    const newBookings = cart.map(item => {
      const court = mockCourts.find(c => c.id === item.courtId);
      return {
        id: `booking-${Date.now()}-${Math.random()}`,
        courtId: item.courtId,
        courtName: item.courtName,
        courtType: item.courtType,
        date: item.date.toISOString(),
        timeSlotFrom: item.timeSlotFrom,
        timeSlotTo: item.timeSlotTo,
        price: item.price,
        operatorId: court?.operatorId || '',
        operatorName: item.operatorName,
        location: court?.location || '',
        city: court?.city || '',
      };
    });

    setBookings([...bookings, ...newBookings]);
    setCart([]);
    setIsCartOpen(false);
    setIsCartSummaryOpen(false);

    toast.success('Bookings confirmed!', {
      description: `Your ${newBookings.length} booking${newBookings.length !== 1 ? 's have' : ' has'} been confirmed`,
    });
  };

  const cartBookingItems = useMemo(() => {
    return cart.map((item) => {
      const courtFromMock = mockCourts.find((court) => court.id === item.courtId);
      const fallbackCourt: Court = courtFromMock ?? {
        id: item.courtId,
        name: item.courtName,
        type: item.courtType,
        operatorId: item.operatorId,
        operatorName: item.operatorName,
        location: '',
        city: '',
        image: '',
        amenities: [],
        rating: 0,
        pricePerHour: item.price,
        availableSlots: [],
      };

      const slotLabels =
        item.timeSlots && item.timeSlots.length > 0
          ? item.timeSlots
          : [formatTimeRangeLabel(item.timeSlotFrom, item.timeSlotTo)];
      const perSlotPrice =
        slotLabels.length > 0 ? item.price / slotLabels.length : item.price;

      const ranges = slotLabels.map((label, index) => {
        const [startTimeRaw, endTimeRaw] = label.split(' - ');
        const startTime = startTimeRaw?.trim() ?? item.timeSlotFrom;
        const endTime = endTimeRaw?.trim() ?? item.timeSlotTo;

        const startSlot =
          fallbackCourt.availableSlots.find((slot) => slot.time === startTime) ?? {
            id: `${item.courtId}-start-${index}`,
            time: startTime,
            available: true,
            price: perSlotPrice,
          };
        const endSlot =
          fallbackCourt.availableSlots.find((slot) => slot.time === endTime) ?? {
            id: `${item.courtId}-end-${index}`,
            time: endTime,
            available: true,
            price: perSlotPrice,
          };

        return {
          startSlot,
          endSlot,
          label,
          price: startSlot.price ?? perSlotPrice,
        };
      });

      return {
        court: fallbackCourt,
        date: item.date,
        ranges,
        totalPrice: item.price,
        totalHours: ranges.length,
      };
    });
  }, [cart]);

  const cartGrandTotalPrice = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price, 0);
  }, [cart]);

  const cartSlotCount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const slotCount = item.timeSlots && item.timeSlots.length > 0 ? item.timeSlots.length : 1;
      return sum + slotCount;
    }, 0);
  }, [cart]);

  const cartGrandTotalHours = useMemo(() => {
    return cartBookingItems.reduce((sum, item) => sum + item.totalHours, 0);
  }, [cartBookingItems]);

  const handleCartProceed = () => {
    if (cart.length === 0) return;
    if (hasPendingBookings) {
      toast.error('Checkout blocked', {
        description:
          'You have a pending booking. Please complete payment before checkout.',
      });
      return;
    }
    setIsCartOpen(false);
    setIsCartSummaryOpen(true);
  };

  const handleToggleBookmark = (operatorId: string, operator?: Operator) => {
    if (bookmarkedOperatorIds.includes(operatorId)) {
      setBookmarkedOperatorIds((prev) => prev.filter((id) => id !== operatorId));
      setBookmarkedOperators((prev) => prev.filter((item) => item.id !== operatorId));
      toast.success('Removed from saved');
    } else {
      setBookmarkedOperatorIds((prev) =>
        prev.includes(operatorId) ? prev : [...prev, operatorId],
      );
      if (operator) {
        setBookmarkedOperators((prev) => {
          if (prev.some((item) => item.id === operator.id)) {
            return prev;
          }
          return [...prev, operator];
        });
      }
      toast.success('Added to saved');
    }
  };

  const syncBookingIndicators = useCallback((items: Booking[]) => {
    const hasUpcomingConfirmedBooking = (item: Booking) => {
      const status = String(item.status ?? '').toLowerCase().trim();
      if (status !== 'confirmed') {
        return false;
      }

      const slotEndTimes: number[] = (Array.isArray(item.bookingCourts)
        ? item.bookingCourts
        : []
      )
        .flatMap((bookingCourt) =>
          Array.isArray(bookingCourt?.slots) ? bookingCourt.slots : [],
        )
        .map((slot) => {
          const slotDate = String(slot?.date ?? '').trim();
          const slotEnd = String(slot?.end_time ?? slot?.start_time ?? '').trim();
          if (!slotDate || !slotEnd) {
            return Number.NaN;
          }
          const endAt = new Date(`${slotDate}T${slotEnd}`).getTime();
          return Number.isFinite(endAt) ? endAt : Number.NaN;
        })
        .filter((value) => Number.isFinite(value));

      if (slotEndTimes.length > 0) {
        return Math.max(...slotEndTimes) > Date.now();
      }

      const fallbackDate = new Date(item.date ?? '').getTime();
      return Number.isFinite(fallbackDate) ? fallbackDate > Date.now() : false;
    };

    const hasPending = items.some((item) => {
      const status = String(item.status ?? '').toLowerCase().trim();
      return status === 'pending';
    });
    const hasConfirmed = items.some((item) =>
      hasUpcomingConfirmedBooking(item),
    );
    setHasPendingBookings(hasPending);
    setHasConfirmedBookings(hasConfirmed);
    setHasFetchedPendingBookings(true);
  }, []);

  const handleBookingsSync = useCallback((items: Booking[]) => {
    setBookings(items);
    syncBookingIndicators(items);
  }, [syncBookingIndicators]);

  return (
    <div
      className="min-h-dvh flex flex-col bg-gray-50 pt-[72px] md:pt-[80px]"
    >
      <Toaster />

      {/* Header */}
      {!isPaymentRoute && (
        <div className={isLoginRequired ? 'md:hidden' : ''}>
          <Header
            cartCount={cartSlotCount}
            onCartClick={handleCartClick}
            onLoginClick={() => setIsLoginModalOpen(true)}
            hasPendingBookings={hasPendingBookings}
            hasConfirmedBookings={hasConfirmedBookings}
            onCloseCart={() => setIsCartOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-[1300px] px-4 md:px-8">
        <React.Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="size-8 border-2 border-gray-200 border-t-[#C8F542] rounded-full animate-spin"></div>
            </div>
          }
        >
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  onAddToCart={handleAddToCart}
                  onPayNow={handlePayNow}
                  bookmarkedOperatorIds={bookmarkedOperatorIds}
                  onToggleBookmark={handleToggleBookmark}
                  requireAuth={requireAuth}
                  onAvailabilityLoaded={() => setIsHomeAvailabilityReady(true)}
                  onEmptyStateChange={setIsHomeEmpty}
                  hasPendingBookings={hasPendingBookings}
                  cartItems={cart}
                />
              }
            />
            <Route
              path="/operator/:operatorId"
              element={
                <OperatorPage
                  onAddToCart={handleAddToCart}
                  onPayNow={handlePayNow}
                  bookmarkedOperatorIds={bookmarkedOperatorIds}
                  onToggleBookmark={handleToggleBookmark}
                  requireAuth={requireAuth}
                  hasPendingBookings={hasPendingBookings}
                  cartItems={cart}
                />
              }
            />
            <Route
              path="/venue/:venueSlug"
              element={
                <OperatorPage
                  onAddToCart={handleAddToCart}
                  onPayNow={handlePayNow}
                  bookmarkedOperatorIds={bookmarkedOperatorIds}
                  onToggleBookmark={handleToggleBookmark}
                  requireAuth={requireAuth}
                  hasPendingBookings={hasPendingBookings}
                  cartItems={cart}
                />
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute onLoginClick={() => setIsLoginModalOpen(true)}>
                  <MyBookings
                    bookings={bookings}
                    onBookingsSync={handleBookingsSync}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookmarks"
              element={
                <ProtectedRoute onLoginClick={() => setIsLoginModalOpen(true)}>
                  <MyBookmarks
                    bookmarkedOperatorIds={bookmarkedOperatorIds}
                    bookmarkedOperators={bookmarkedOperators}
                    onToggleBookmark={handleToggleBookmark}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-us"
              element={<ContactUs />}
            />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            <Route
              path="/payment/successful"
              element={<PaymentSuccess />}
            />
            <Route path="/payment/failed" element={<PaymentFailed />} />
            <Route path="/payment/cancelled" element={<PaymentCancelled />} />
            <Route
              path="/__test/error-boundary"
              element={<ErrorBoundaryTestPage />}
            />
            <Route path="/500" element={<ServerErrorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>
      </main>

      {/* Cart */}
      <Cart
        items={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onRemoveItem={handleRemoveFromCart}
        onRemoveSlot={handleRemoveSlotFromCart}
        onCheckout={handleCartProceed}
        hasPendingBookings={hasPendingBookings}
      />

      <BookingSummaryModal
        isOpen={isCartSummaryOpen}
        onClose={() => setIsCartSummaryOpen(false)}
        bookingsByCourtAndDate={cartBookingItems}
        grandTotalPrice={cartGrandTotalPrice}
        grandTotalHours={cartGrandTotalHours}
        onConfirm={handleCheckout}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <AlertDialog open={isVenueLimitOpen} onOpenChange={setIsVenueLimitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cart limited to one venue</AlertDialogTitle>
            <AlertDialogDescription>
              Checkout or clear your cart before booking a different venue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setIsVenueLimitOpen(false)}>
            Got it
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer */}
      {!hideFooterRoutes && (
        <Footer
          className={
            hideFooterOnMobile || hideFooterForHomeEmptyOnMobile
              ? 'hidden sm:block'
              : ''
          }
        />
      )}


    </div>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProviders>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppErrorBoundary>{children}</AppErrorBoundary>
    </AuthProvider>
  );
}
