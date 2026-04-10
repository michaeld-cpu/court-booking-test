import { CartItem } from '../types';
import { Button } from './ui/button';
import { X, ShoppingCart, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import React from 'react';
import { formatCurrency } from '../lib/formatCurrency';
import { DynamicClock } from './DynamicClock';
import { formatTimeRangeLabel, formatTimeValue } from '../lib/timeFormat';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from './EmptyState';

interface CartProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveSlot: (itemId: string, slotLabel: string) => void;
  onCheckout: () => void;
  hasPendingBookings?: boolean;
}

export function Cart({
  items,
  isOpen,
  onClose,
  onRemoveItem,
  onRemoveSlot,
  onCheckout,
  hasPendingBookings,
}: CartProps) {
  const navigate = useNavigate();
  if (!isOpen) return null;
  const itemCardClass = 'overflow-hidden rounded-2xl md:rounded-lg border border-gray-100 bg-white shadow-sm';
  const slotsListClass = 'space-y-1 bg-white px-4 py-3 pb-4';

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalSlots = items.reduce((sum, item) => {
    if (item.timeSlots && item.timeSlots.length > 0) {
      return sum + item.timeSlots.length;
    }
    return sum + 1;
  }, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-x-0 top-0 bottom-0 bg-black/50 z-[1120]"
        onClick={onClose}
      />

      {/* Cart Sidebar */}
      <div className="fixed right-0 top-14 bottom-0 w-full md:w-[400px] bg-white shadow-xl z-[1150] flex flex-col border-t border-gray-100">
        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <EmptyState
              icon={
                <div className="rounded-full bg-gray-100/80 p-4">
                  <ShoppingCart className="size-8 text-gray-400" />
                </div>
              }
              title="No items in cart"
              description={
                <>
                  Add court slots to your cart <br />to continue checkout.
                </>
              }
              action={
                <Button
                  className="h-11 px-6 py-2.5 rounded-xl text-sm font-semibold bg-black text-white hover:bg-gray-900 shadow-sm transition-all w-fit"
                  onClick={() => {
                    onClose();
                    navigate('/');
                  }}
                >
                  Browse Courts
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const slotLabels =
                  item.timeSlots && item.timeSlots.length > 0
                    ? item.timeSlots
                    : [`${item.timeSlotFrom} - ${item.timeSlotTo}`];
                const perSlotPrice =
                  slotLabels.length > 0 ? item.price / slotLabels.length : item.price;

                return (
                  <div key={item.id} className={itemCardClass}>
                    <div className="bg-white px-4 py-4 border-b border-gray-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="font-semibold text-sm text-gray-900">
                            {item.operatorName} - {(item.courtType ?? 'Others').charAt(0).toUpperCase() +
                              (item.courtType ?? 'Others').slice(1)} {item.courtName}
                          </strong>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                            <Calendar className="size-4 text-slate-500" />
                            <span>{format(item.date, 'EEE, MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="text-gray-500 hover:text-red-600 shrink-0 mr-1 mt-1"
                          aria-label="Remove court from cart"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>

                    <div className={slotsListClass}>
                      {slotLabels.map((label, index) => {
                        const [startTimeRaw, endTimeRaw] = label.split(' - ');
                        const startTime = formatTimeValue(
                          startTimeRaw?.trim() ?? item.timeSlotFrom,
                          false
                        );
                        const endTime = formatTimeValue(
                          endTimeRaw?.trim() ?? item.timeSlotTo,
                          true
                        );
                        const rangeLabel = formatTimeRangeLabel(
                          startTimeRaw?.trim() ?? item.timeSlotFrom,
                          endTimeRaw?.trim() ?? item.timeSlotTo
                        );
                        return (
                          <div key={`${item.id}-slot-${index}`} className="flex items-center justify-between py-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                              <DynamicClock time={startTime} className="size-4 flex-shrink-0" />
                              <span>{rangeLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>₱{formatCurrency(perSlotPrice)}</span>
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

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-4 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] md:pb-4 space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-base md:text-lg font-semibold text-slate-900">
                Total ({totalSlots} {totalSlots === 1 ? 'Slot' : 'Slots'})
              </span>
              <span className="text-base md:text-lg font-bold text-slate-900">
                ₱{formatCurrency(totalPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Button
              className="w-full h-14 md:h-11 rounded-2xl md:rounded-lg text-lg md:text-sm font-semibold bg-black hover:bg-slate-900 shadow-lg md:shadow-none text-white transition-all"
              size="lg"
              onClick={onCheckout}
              disabled={hasPendingBookings}
            >
              Proceed to Checkout
            </Button>
            {hasPendingBookings && (
              <p className="text-xs text-red-600 text-center">
                You have a pending booking. Complete payment first.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
