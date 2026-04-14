import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, MapPin, Calendar, Clock, Info, ShoppingCart, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Court, TimeSlot } from '../types';
import { format, isSameDay, parse } from 'date-fns';
import type { CartItem } from '../types';
import { DynamicClock } from './DynamicClock';
import { Icons } from './ui/icons';
import { BookingSummaryModal } from './BookingSummaryModal';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as CalendarComponent } from './ui/calendar';
import { formatCurrency } from '../lib/formatCurrency';
import { formatTimeRangeLabel } from '../lib/timeFormat';
import { maxSlotSelection } from '../lib/config';
import { toast } from '@/app/lib/toast';

interface BookingModalProps {
  court: Court | null;
  date: Date;
  timeFrom: string;
  timeTo: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot) => void;
  onPayNow?: (timeSlotFrom: TimeSlot, timeSlotTo: TimeSlot) => void;
  preselectedSlotId?: string | null;
  onDateChange?: (date: Date) => void;
  isLoadingSlots?: boolean;
  hasPendingBookings?: boolean;
  cartItems?: CartItem[];
}

interface TimeRange {
  id: string;
  startSlot: TimeSlot;
  endSlot: TimeSlot;
  label: string;
  available: boolean;
  price: number;
}

type TimeGroup = '' | 'Morning' | 'Afternoon' | 'Evening';

const SELECTION_TIPS = [
  'Tap time slots to select or unselect.',
  'You can select multiple timeslots.',
  'Only contiguous times lots are allowed.',
];

const buildTimeRanges = (slots: TimeSlot[]): TimeRange[] => {
  const ranges: TimeRange[] = [];
  for (let i = 0; i < slots.length - 1; i++) {
    const startSlot = slots[i];
    const endSlot = slots[i + 1];
    ranges.push({
      id: `range-${i}`,
      startSlot,
      endSlot,
      label: formatTimeRangeLabel(startSlot.time, endSlot.time),
      available: startSlot.available,
      price: startSlot.price,
    });
  }
  return ranges;
};

const getTimeGroup = (timeLabel: string): TimeGroup => {
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

const getRangeIndex = (rangeId: string): number => {
  const parsed = Number(rangeId.replace('range-', ''));
  return Number.isNaN(parsed) ? -1 : parsed;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normalizeVenueKey = (value: string | null | undefined) =>
  normalizeText(value).replace(/^venue-/, '');

export function BookingModal({ court, date, timeFrom, timeTo, isOpen, onClose, onConfirm, onPayNow, preselectedSlotId, onDateChange, isLoadingSlots, hasPendingBookings: _hasPendingBookings, cartItems = [] }: BookingModalProps) {
  const navigate = useNavigate();
  const [selectedRanges, setSelectedRanges] = useState<string[]>([]);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectionTipIndex, setSelectionTipIndex] = useState(0);
  const [isTipAnimating, setIsTipAnimating] = useState(false);
  const [isTipAutoRotatePaused, setIsTipAutoRotatePaused] = useState(false);
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const sheetTouchStartYRef = useRef<number | null>(null);
  const sheetTouchStartXRef = useRef<number | null>(null);
  const sheetTouchStartTimeRef = useRef<number>(0);
  const sheetTouchStartedOnHandleRef = useRef(false);
  const canDragSheetRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSelectionContextRef = useRef<string | null>(null);
  const selectionLimit = maxSlotSelection;

  useEffect(() => {
    setSelectedRanges([]);
  }, [date]);

  // Auto-select only preselected slot when modal opens.
  useEffect(() => {
    if (!court || !isOpen) {
      return;
    }

    const ranges = buildTimeRanges(court.availableSlots);
    const contextKey = `${court.id}__${format(date, 'yyyy-MM-dd')}`;
    const contextChanged = lastSelectionContextRef.current !== contextKey;
    lastSelectionContextRef.current = contextKey;

    if (preselectedSlotId) {
      const slotExists = ranges.find((range) => range.id === preselectedSlotId);
      if (slotExists) {
        setSelectedRanges([preselectedSlotId]);
        return;
      }
    }

    if (contextChanged) {
      setSelectedRanges([]);
      return;
    }

    const validIds = new Set(ranges.map((range) => range.id));
    setSelectedRanges((prev) =>
      prev
        .filter((rangeId) => validIds.has(rangeId))
        .sort((a, b) => getRangeIndex(a) - getRangeIndex(b)),
    );
  }, [isOpen, preselectedSlotId, court, date]);

  useEffect(() => {
    if (!isOpen) return;
    const randomIndex = Math.floor(Math.random() * SELECTION_TIPS.length);
    setSelectionTipIndex(randomIndex);
    setIsTipAutoRotatePaused(false);
  }, [isOpen, date, court?.id]);

  const cycleTip = useCallback(() => {
    if (SELECTION_TIPS.length <= 1) return;
    setIsTipAnimating(true);
    setSelectionTipIndex((prev) => (prev + 1) % SELECTION_TIPS.length);
    window.setTimeout(() => {
      setIsTipAnimating(false);
    }, 180);
  }, []);

  const safeCourtId = court?.id ?? '';
  const safeAvailableSlots = court?.availableSlots ?? [];
  const safeCourtName = court?.name ?? '';
  const safeOperatorId = court?.operatorId ?? '';
  const safeOperatorName = court?.operatorName ?? '';
  const timeRanges = useMemo(
    () => buildTimeRanges(safeAvailableSlots),
    [safeAvailableSlots],
  );
  const cartRangeIds = useMemo(() => {
    const ids = new Set<string>();
    const cartLabels = new Set<string>();
    const normalizedCourtId = normalizeText(safeCourtId);
    const normalizedCourtName = normalizeText(safeCourtName);
    const normalizedOperatorId = normalizeVenueKey(safeOperatorId);
    const normalizedOperatorName = normalizeText(safeOperatorName);

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

      if (!isSameCourtById && !isSameCourtByName) {
        return;
      }
      const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
      if (Number.isNaN(itemDate.getTime()) || !isSameDay(itemDate, date)) {
        return;
      }
      item.timeSlots?.forEach((label) => {
        if (label) {
          cartLabels.add(label);
        }
      });
    });

    timeRanges.forEach((range) => {
      if (cartLabels.has(range.label)) {
        ids.add(range.id);
      }
    });

    return ids;
  }, [
    cartItems,
    safeCourtId,
    safeCourtName,
    safeOperatorId,
    safeOperatorName,
    date,
    timeRanges,
  ]);

  const groupedTimeRanges: Record<TimeGroup, TimeRange[]> = {
    '': timeRanges.filter((range) => getTimeGroup(range.startSlot.time) === ''),
    Morning: timeRanges.filter((range) => getTimeGroup(range.startSlot.time) === 'Morning'),
    Afternoon: timeRanges.filter((range) => getTimeGroup(range.startSlot.time) === 'Afternoon'),
    Evening: timeRanges.filter((range) => getTimeGroup(range.startSlot.time) === 'Evening'),
  };

  // Toggle time range selection
  const toggleTimeRange = (rangeId: string) => {
    setSelectedRanges((prev) => {
      if (prev.includes(rangeId)) {
        const removedIndex = getRangeIndex(rangeId);
        const selectedIndices = prev.map((id) => getRangeIndex(id));
        const minSelectedIndex = Math.min(...selectedIndices);

        if (removedIndex === minSelectedIndex) {
          return prev
            .filter((id) => id !== rangeId)
            .sort((a, b) => getRangeIndex(a) - getRangeIndex(b));
        }

        return prev
          .filter((id) => getRangeIndex(id) < removedIndex)
          .sort((a, b) => getRangeIndex(a) - getRangeIndex(b));
      } else {
        const nextIndices = [...prev.map((id) => getRangeIndex(id)), getRangeIndex(rangeId)];
        const minIndex = Math.min(...nextIndices);
        const maxIndex = Math.max(...nextIndices);
        const filledIds = Array.from(
          { length: maxIndex - minIndex + 1 },
          (_, offset) => `range-${minIndex + offset}`,
        );

        if (filledIds.length > selectionLimit) {
          toast.warning('Slot limit reached', {
            description: `You can only select up to ${selectionLimit} slots per court.`,
          });
          const cappedIds = Array.from(
            { length: selectionLimit },
            (_, offset) => `range-${minIndex + offset}`,
          );
          const cappedRanges = cappedIds
            .map((id) => timeRanges.find((range) => range.id === id))
            .filter((range): range is TimeRange => Boolean(range));
          const hasUnavailableInCap =
            cappedRanges.length !== cappedIds.length ||
            cappedRanges.some((range) => !range.available || cartRangeIds.has(range.id));

          if (hasUnavailableInCap) {
            return prev;
          }
          return cappedIds;
        }

        const filledRanges = filledIds
          .map((id) => timeRanges.find((range) => range.id === id))
          .filter((range): range is TimeRange => Boolean(range));
        if (filledRanges.length !== filledIds.length) {
          return prev;
        }

        const hasUnavailableInBetween = filledRanges.some(
          (range) => !range.available || cartRangeIds.has(range.id),
        );
        if (hasUnavailableInBetween) {
          toast.info('Cannot skip unavailable slots', {
            description: 'Select slots within an available continuous block.',
          });
          return prev;
        }

        return filledIds.sort((a, b) => getRangeIndex(a) - getRangeIndex(b));
      }
    });
  };

  // Select all available time slots
  const handleSelectAll = () => {
    const availableRangeIds = timeRanges
      .filter((range) => range.available && !cartRangeIds.has(range.id))
      .map((range) => range.id);
    const limitedRangeIds = availableRangeIds.slice(0, selectionLimit);
    
    const allSelected =
      limitedRangeIds.length > 0 &&
      limitedRangeIds.every((id) => selectedRanges.includes(id)) &&
      selectedRanges.length === limitedRangeIds.length;
    
    if (allSelected) {
      // Unselect all
      setSelectedRanges([]);
    } else {
      // Select all available
      if (availableRangeIds.length > selectionLimit) {
        toast.warning('Slot limit reached', {
          description: `You can only select up to ${selectionLimit} slots per court.`,
        });
      }
      setSelectedRanges(limitedRangeIds);
    }
  };

  // Check if all available slots are selected
  const allAvailableSelected = () => {
    const availableRangeIds = timeRanges
      .filter((range) => range.available && !cartRangeIds.has(range.id))
      .map((range) => range.id);
    const limitedRangeIds = availableRangeIds.slice(0, selectionLimit);
    return (
      limitedRangeIds.length > 0 &&
      limitedRangeIds.every((id) => selectedRanges.includes(id)) &&
      selectedRanges.length === limitedRangeIds.length
    );
  };

  // Calculate booking details
  const calculateBookingDetails = () => {
    if (selectedRanges.length === 0) return null;

    const selectedTimeRanges = selectedRanges
      .map((id) => timeRanges.find((r) => r.id === id))
      .filter((r) => r !== undefined) as TimeRange[];

    const totalPrice = selectedTimeRanges.reduce((sum, range) => sum + range.price, 0);
    const duration = selectedTimeRanges.length;
    
    // Get overall time range
    const firstRange = selectedTimeRanges[0];
    const lastRange = selectedTimeRanges[selectedTimeRanges.length - 1];
    const timeLabel = formatTimeRangeLabel(
      firstRange.startSlot.time,
      lastRange.endSlot.time
    );

    return { totalPrice, duration, timeLabel, firstRange, lastRange };
  };

  const bookingDetails = calculateBookingDetails();
  const hasBookingDetails = Boolean(bookingDetails);

  useEffect(() => {
    if (
      !isOpen ||
      hasBookingDetails ||
      isTipAutoRotatePaused ||
      SELECTION_TIPS.length <= 1
    ) {
      return;
    }
    const intervalId = window.setInterval(() => {
      cycleTip();
    }, 3000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, hasBookingDetails, isTipAutoRotatePaused, cycleTip]);

  const handleOpenSummary = () => {
    if (selectedRanges.length > 0) {
      setIsSummaryModalOpen(true);
    }
  };

  const handleConfirmBooking = () => {
    if (bookingDetails) {
      onConfirm(bookingDetails.firstRange.startSlot, bookingDetails.lastRange.endSlot);
      setSelectedRanges([]);
      setIsSummaryModalOpen(false);
      onClose();
    }
  };

  const handlePayNow = () => {
    if (bookingDetails && onPayNow) {
      onPayNow(bookingDetails.firstRange.startSlot, bookingDetails.lastRange.endSlot);
      setSelectedRanges([]);
      setIsSummaryModalOpen(false);
      onClose();
    }
  };

  const handleClose = () => {
    setBookingConfirmed(false);
    setSelectedRanges([]);
    setIsSummaryModalOpen(false);
    setSheetDragOffset(0);
    setIsSheetDragging(false);
    sheetTouchStartYRef.current = null;
    sheetTouchStartXRef.current = null;
    sheetTouchStartedOnHandleRef.current = false;
    canDragSheetRef.current = false;
    onClose();
  };

  const handleSheetTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 640) return;
    const target = event.target as HTMLElement | null;
    const isHandle = Boolean(target?.closest('[data-sheet-handle="true"]'));
    const isAtTop = (scrollContainerRef.current?.scrollTop ?? 0) <= 0;
    sheetTouchStartedOnHandleRef.current = isHandle;
    if (!isHandle && !isAtTop) {
      canDragSheetRef.current = false;
      return;
    }
    canDragSheetRef.current = true;
    sheetTouchStartYRef.current = event.touches[0]?.clientY ?? null;
    sheetTouchStartXRef.current = event.touches[0]?.clientX ?? null;
    sheetTouchStartTimeRef.current = Date.now();
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!canDragSheetRef.current || sheetTouchStartYRef.current === null) return;
    const touch = event.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const currentX = touch.clientX;
    const deltaY = currentY - sheetTouchStartYRef.current;
    const deltaX = sheetTouchStartXRef.current === null ? 0 : currentX - sheetTouchStartXRef.current;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }

    const isAtTop = (scrollContainerRef.current?.scrollTop ?? 0) <= 0;
    if (!sheetTouchStartedOnHandleRef.current && !isAtTop) {
      canDragSheetRef.current = false;
      setIsSheetDragging(false);
      setSheetDragOffset(0);
      return;
    }

    if (deltaY <= 0) {
      canDragSheetRef.current = false;
      setIsSheetDragging(false);
      setSheetDragOffset(0);
      return;
    }

    if (!sheetTouchStartedOnHandleRef.current && deltaY < 10) {
      return;
    }

    if (!isSheetDragging) {
      setIsSheetDragging(true);
    }
    setSheetDragOffset(deltaY);
  };

  const handleSheetTouchEnd = () => {
    if (!canDragSheetRef.current || sheetTouchStartYRef.current === null) {
      setIsSheetDragging(false);
      return;
    }
    const elapsed = Math.max(1, Date.now() - sheetTouchStartTimeRef.current);
    const velocity = sheetDragOffset / elapsed;
    const shouldClose = sheetDragOffset > 120 || velocity > 0.8;

    canDragSheetRef.current = false;
    sheetTouchStartYRef.current = null;
    sheetTouchStartXRef.current = null;
    sheetTouchStartedOnHandleRef.current = false;
    setIsSheetDragging(false);

    if (shouldClose) {
      handleClose();
      return;
    }
    setSheetDragOffset(0);
  };

  const getSelectedTimeRanges = () => {
    return selectedRanges
      .map((id) => timeRanges.find((r) => r.id === id))
      .filter((r) => r !== undefined)
      .map(r => ({
        startSlot: r!.startSlot,
        endSlot: r!.endSlot,
        label: r!.label,
        price: r!.price,
      }));
  };

  if (!court) return null;

  return (
    <>
      <Dialog open={isOpen && !isSummaryModalOpen} onOpenChange={handleClose}>
        <DialogContent
          className="top-auto left-0 right-0 bottom-0 z-[3010] max-w-full translate-x-0 translate-y-0 rounded-t-3xl rounded-b-none border-0 p-0 !bg-gray-900 max-h-[80vh] overflow-hidden flex flex-col gap-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom [&>[data-slot='dialog-close']]:hidden sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:[&>[data-slot='dialog-close']]:inline-flex sm:top-[50%] sm:left-[50%] sm:right-auto sm:bottom-auto sm:max-w-lg sm:max-h-[90vh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border sm:p-0"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          style={{
            transform:
              sheetDragOffset > 0
                ? `translateY(${sheetDragOffset}px)`
                : undefined,
            transition: isSheetDragging ? 'none' : undefined,
          }}
        >
          <div
            data-sheet-handle="true"
            className="mx-auto mt-3 mb-1.5 h-1.5 w-10 rounded-full bg-gray-500 touch-none sm:hidden shrink-0"
          />
          {/* Dark Header */}
          <DialogHeader className="pb-5 pt-2 px-5 bg-gray-900 relative shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-4 right-4 flex items-center justify-center size-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-10"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <DialogTitle
              className="md:text-2xl text-xl font-bold uppercase tracking-wide text-white pt-3"
              style={{ fontFamily: "'Bebas Neue', 'Alegreya Sans', sans-serif", letterSpacing: '0.04em' }}
            >
              {court.operatorName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select booking date and available time slots.
            </DialogDescription>
            <div className="flex items-center justify-between mt-2 gap-3">
              <div className="min-w-0 flex items-center gap-1.5 text-sm text-white/70">
                {court.purpose?.toLowerCase().includes('pickle') ? (
                  <Icons.pickleball className="size-4 text-white/70" />
                ) : (
                  <DynamicClock time="12:00 PM" className="size-4 text-white/70" />
                )}
                <p className="truncate font-medium">
                  {(court.purpose ?? 'Others').charAt(0).toUpperCase() +
                    (court.purpose ?? 'Others').slice(1)} {court.name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                    >
                      <Calendar className="size-3.5 text-[#C8F542]" />
                      {isSameDay(date, new Date())
                        ? `Today – ${format(date, 'MMM dd, yyyy')}`
                        : format(date, 'EEE, MMM dd, yyyy')}
                      <ChevronDown className="size-3 text-white/60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[1500] w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={date}
                      onSelect={(selected) => {
                        if (!selected) return;
                        onDateChange?.(selected);
                        setIsDatePickerOpen(false);
                      }}
                      disabled={{ before: new Date() }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-0 bg-white px-5 sm:px-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400"
          >
              {/* Time Range Selection */}
              <div className="pt-4 pb-4">
              {/* <div className="flex items-center justify-between mb-3"> */}
                {/* <h4 className="font-semibold text-sm">Select Time Slots</h4> */}
                {/* <button
                  onClick={handleSelectAll}
                  disabled={isLoadingSlots || timeRanges.filter((range) => range.available).length === 0}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {allAvailableSelected() ? 'Unselect All' : 'Select All'}
                </button> */}
              {/* </div> */}
              <div
                className={`space-y-4 transition-opacity duration-200 ${
                  isLoadingSlots ? 'opacity-45 pointer-events-none' : 'opacity-100'
                }`}
              >
                {(['Morning', 'Afternoon', 'Evening'] as TimeGroup[]).map((group, groupIndex) => {
                  const ranges = groupedTimeRanges[group];
                  if (ranges.length === 0) {
                    return null;
                  }
                  return (
                    <div
                      key={group}
                      className={`space-y-2 ${groupIndex > 0 ? 'pt-3' : ''}`}
                    >
                      {group ? (
                        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
                          {group}
                        </div>
                      ) : null}
                      {ranges.map((range) => {
                        const isAlreadyInCart = cartRangeIds.has(range.id);
                        const isSelected = isAlreadyInCart || selectedRanges.includes(range.id);
                        return (
                          <button
                            key={range.id}
                            onClick={() => {
                              if (isAlreadyInCart) {
                                toast.info('Already added to cart', {
                                  description: 'Check your cart to manage this slot.',
                                });
                                return;
                              }
                              if (range.available) {
                                toggleTimeRange(range.id);
                              }
                            }}
                            disabled={isLoadingSlots || (!range.available && !isAlreadyInCart)}
                              className={`w-full px-3 py-2 rounded-lg text-sm transition-all text-left ${
                              isSelected
                                ? 'bg-gray-900 text-white'
                                : !range.available
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                {isSelected ? (
                                  <Check className="size-4 flex-shrink-0 text-white" />
                                ) : (
                                  <DynamicClock time={range.startSlot.time} className="size-4 flex-shrink-0" />
                                )}
                                <div className="font-semibold">{range.label}</div>
                              </div>
                              <div className="font-semibold">₱{formatCurrency(range.price)}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              </div>
          </div>

          {/* Sticky Booking Summary and Actions */}
          <div
            className="bg-white space-y-3 px-5 pb-4 pt-2 sm:px-6 sm:pb-6 shrink-0"
          >
            {/* Booking Summary */}
            {bookingDetails ? (
              <div className="h-12 rounded-lg bg-gray-50 px-4">
                <div className="flex h-full items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Total ({bookingDetails.duration} slot{bookingDetails.duration !== 1 ? 's' : ''})</span>
                  <span className="text-sm font-semibold text-slate-900">₱{formatCurrency(bookingDetails.totalPrice)}</span>
                </div>
              </div>
            ) : (
              <div
                className="h-12 rounded-lg bg-blue-50 px-4 text-blue-700"
                onClick={() => setIsTipAutoRotatePaused(true)}
              >
                <div className="flex h-full items-center justify-between gap-2">
                  <div
                    className={`flex items-center gap-2 text-sm transition-all duration-200 ${
                      isTipAnimating ? 'translate-x-1 opacity-0' : 'translate-x-0 opacity-100'
                    }`}
                  >
                  <Info className="size-4" />
                    <span>{SELECTION_TIPS[selectionTipIndex]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTipAutoRotatePaused(true);
                      cycleTip();
                    }}
                    className="rounded-full p-1 text-blue-700/80 transition-colors hover:bg-blue-100 hover:text-blue-900"
                    aria-label="Next tip"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleConfirmBooking}
                  disabled={!bookingDetails}
                  className="w-full h-12 gap-2 rounded-lg border-gray-300 text-sm font-semibold"
                  variant="outline"
                >
                  <ShoppingCart className="size-4" />
                  Add to cart
                </Button>
                <Button
                  onClick={handleOpenSummary}
                  disabled={!bookingDetails}
                  className="w-full h-12 rounded-lg bg-gray-900 text-sm font-semibold hover:bg-gray-800"
                >
                  Checkout
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Summary Modal */}
      <BookingSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        court={court}
        date={date}
        timeRanges={getSelectedTimeRanges()}
        totalPrice={bookingDetails?.totalPrice || 0}
        onConfirm={handleConfirmBooking}
        onPayNow={handlePayNow}
      />
    </>
  );
}
