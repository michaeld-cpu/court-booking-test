import { MapPin, Star, Bookmark } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Court } from '../types';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { courtTypeIcons } from '../lib/courtTypeColors';
import { Icons } from './ui/icons';
import React from 'react'
interface CourtCardProps {
  court: Court;
  onBook: (court: Court) => void;
  onOperatorClick?: () => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (operatorId: string) => void;
  isBooking?: boolean;
}

export function CourtCard({ court, onBook, onOperatorClick, isBookmarked, onToggleBookmark, isBooking }: CourtCardProps) {
  const availableSlotsCount =
    typeof court.availableSlotCount === 'number'
      ? court.availableSlotCount
      : court.availableSlots.filter(slot => slot.available).length;
  const rawPurpose = String(court.purpose ?? court.type ?? 'Others');
  const purposeLabel =
    rawPurpose
      .toLowerCase()
      .replace(/\bcourts?\b/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'others';
  const purposeText = purposeLabel.charAt(0).toUpperCase() + purposeLabel.slice(1);
  const purposeIcon = courtTypeIcons[purposeLabel];
  const isPickleball = purposeLabel === 'pickleball' || purposeLabel === 'pickle';

  return (
    <div className="flex items-center gap-3 py-4 sm:py-4.5 last:pb-0 last:border-b-0 ">
      {/* Type Badge */}
      <div className="w-9 h-9 flex items-center justify-center shrink-0">
        {isPickleball ? (
          <Icons.pickleball className="size-7 text-black" />
        ) : purposeIcon && (
          <img
            src={purposeIcon}
            alt={`${purposeText} icon`}
            className="size-7"
            loading="lazy"
          />
        )}
      </div>

      {/* Court Name and Slots */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate"> {purposeText} {court.name}</div>
        <div className="text-xs text-gray-600 flex items-center gap-2 mt-[2px]">
          <span>{availableSlotsCount} slot{availableSlotsCount !== 1 ? 's' : ''}</span>
          {/* <span className="text-gray-400">•</span>
          <span className="text-gray-900">₱{court.pricePerHour}</span> */}
        </div>
      </div>

      {/* Book Button */}
      <Button
        onClick={() => onBook(court)}
        size="sm"
        disabled={isBooking}
        className="whitespace-nowrap px-4 min-w-[80px]"
      >
        {isBooking ? (
          <svg
            className="size-4 animate-spin text-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          'Book'
        )}
      </Button>
    </div>
  );
}
