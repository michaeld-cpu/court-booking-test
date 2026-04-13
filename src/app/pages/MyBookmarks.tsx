import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockCourts, operators } from '../data/mockData';
import { Card } from '../components/ui/card';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { EmptyState } from '../components/EmptyState';
import { ArrowUpRight, Bookmark, ChevronRight, ListFilter, MapPin, Share2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Operator, Court } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { resolveVenueBannerUrl } from '../lib/venueBanner';
import { toast } from '@/app/lib/toast';

interface MyBookmarksProps {
  bookmarkedOperatorIds: string[];
  bookmarkedOperators: Operator[];
  onToggleBookmark: (operatorId: string, operator?: Operator) => void;
}

export function MyBookmarks({
  bookmarkedOperatorIds,
  bookmarkedOperators,
  onToggleBookmark,
}: MyBookmarksProps) {
  const sortStorageKey = 'courtbook_mybookmarks_sort_by';
  const getStoredSortBy = (): 'date_added' | 'name' => {
    if (typeof window === 'undefined') {
      return 'date_added';
    }
    try {
      const stored = localStorage.getItem(sortStorageKey);
      return stored === 'name' ? 'name' : 'date_added';
    } catch {
      return 'date_added';
    }
  };
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'date_added' | 'name'>(getStoredSortBy);
  const [cachedCourts, setCachedCourts] = useState<Court[]>([]);

  useEffect(() => {
    try {
      const courtsMap = new Map<string, Court>();
      const AVAILABILITY_CACHE_KEY_PREFIX = 'courtbook_home_availability:';
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(AVAILABILITY_CACHE_KEY_PREFIX)) {
          const raw = sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.courts)) {
              parsed.courts.forEach((court: Court) => {
                courtsMap.set(court.id, court);
              });
            }
          }
        }
      }
      setCachedCourts(Array.from(courtsMap.values()));
    } catch (e) {
      console.error('Failed to load cached courts in MyBookmarks', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(sortStorageKey, sortBy);
    } catch {
      // Ignore storage write failures.
    }
  }, [sortBy, sortStorageKey]);

  const resolvedBookmarkedOperators = useMemo(() => {
    const combined = new Map<string, Operator>();
    operators.forEach((operator) => {
      if (bookmarkedOperatorIds.includes(operator.id)) {
        combined.set(operator.id, operator);
      }
    });
    bookmarkedOperators.forEach((operator) => {
      if (bookmarkedOperatorIds.includes(operator.id)) {
        combined.set(operator.id, operator);
      }
    });
    return Array.from(combined.values());
  }, [bookmarkedOperatorIds, bookmarkedOperators]);

  const sortedBookmarkedOperators = useMemo(() => {
    const list = [...resolvedBookmarkedOperators];
    if (sortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const idOrder = new Map(
      bookmarkedOperatorIds.map((id, index) => [id, index]),
    );
    return list.sort((a, b) => {
      const aIndex = idOrder.get(a.id) ?? -1;
      const bIndex = idOrder.get(b.id) ?? -1;
      return bIndex - aIndex;
    });
  }, [resolvedBookmarkedOperators, bookmarkedOperatorIds, sortBy]);

  const toVenueSlug = (operator: Operator) => {
    const numericId = operator.id.startsWith('venue-')
      ? operator.id.replace('venue-', '')
      : operator.id;
    const nameSlug = operator.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
    return `${numericId}-${nameSlug || 'venue'}`;
  };

  const handleOperatorClick = (operator: Operator) => {
    if (operator.id.startsWith('venue-')) {
      navigate(`/venue/${toVenueSlug(operator)}`);
      return;
    }
    navigate(`/operator/${operator.id}`);
  };

  const getOperatorPath = (operator: Operator) => {
    if (operator.id.startsWith('venue-')) {
      return `/venue/${toVenueSlug(operator)}`;
    }
    return `/operator/${operator.id}`;
  };

  const handleShareClick = async (event: React.MouseEvent, operator: Operator) => {
    event.stopPropagation();
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${getOperatorPath(operator)}`
        : getOperatorPath(operator);
    const shareData = {
      title: operator.name,
      text: `Check out ${operator.name} on Korte`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // Ignore cancellation errors and proceed to clipboard fallback.
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied', {
        description: 'Venue link copied to clipboard.',
      });
    } catch {
      toast.error('Unable to share', {
        description: 'Please copy the URL from your browser.',
      });
    }
  };

  if (resolvedBookmarkedOperators.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-80px)]">
        <EmptyState
          wrapperClassName="flex items-center justify-center"
          icon={
            <div className="rounded-full bg-gray-100/80 p-4">
              <Bookmark className="size-8 text-gray-400" />
            </div>
          }
          title="No Saved Venues"
          description={
            <>
              Tap the bookmark icon on any venue to save it<br className="hidden sm:block" /> here for quick access later.
            </>
          }
          action={
            <Button
              asChild
              className="h-11 px-6 py-2.5 rounded-lg text-sm font-medium bg-black text-white hover:bg-gray-900 shadow-sm transition-all w-fit"
            >
              <Link to="/">
                Browse Courts
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="pt-4 pb-0 md:pb-8 min-h-svh">
      <div className="mx-auto w-full max-w-[1300px] mb-6 flex items-center justify-between px-4 md:px-0 py-2 border-b border-gray-100 sm:border-none">
        <h1 className="text-2xl md:text-3xl font-bold font-bebas uppercase tracking-wide text-gray-900">
          Saved
        </h1>
      </div>

      <div className="mx-auto w-full max-w-[1300px] px-4 md:px-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sortedBookmarkedOperators.map((operator) => {
          const venuesCourts = [
            ...mockCourts.filter((c: Court) => c.operatorId === operator.id),
            ...cachedCourts.filter((c: Court) => c.operatorId === operator.id)
          ];
          
          // Use a Map to deduplicate courts by ID in case they exist in both mock and cache
          const uniqueCourts = Array.from(
            venuesCourts.reduce((map, court) => map.set(court.id, court), new Map<string, Court>()).values()
          );

          const courtsCount = uniqueCourts.length;
          const minPrice = uniqueCourts.length > 0 
            ? Math.min(...uniqueCourts.map((c: Court) => c.pricePerHour))
            : 0;
          
          const isCovered = operator.amenities?.some(a => 
            a.toLowerCase().includes('covered') || a.toLowerCase().includes('indoor')
          );

          return (
            <Card
              key={operator.id}
              onClick={() => handleOperatorClick(operator)}
              className="group cursor-pointer overflow-hidden border-gray-100 bg-white shadow-sm transition-all hover:shadow-md rounded-xl flex flex-col gap-0"
            >
              <div className="relative h-40 sm:h-48 lg:h-52 w-full overflow-hidden shrink-0">
                <ImageWithFallback
                  src={resolveVenueBannerUrl(operator.image, operator.id)}
                  alt={operator.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 transition-opacity" />
                
                {isCovered && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-[#C8F542] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#000000]">
                      Covered
                    </div>
                  </div>
                )}

                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    className="flex size-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white transition-all hover:bg-black/50"
                    onClick={(event) => void handleShareClick(event, operator)}
                  >
                    <Share2 className="size-4" />
                  </button>
                  <button
                    className="flex size-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-[#C8F542] transition-all hover:bg-black/50"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleBookmark(operator.id, operator)
                    }}
                  >
                    <Bookmark className="size-4 fill-current" />
                  </button>
                </div>

                <div className="absolute bottom-5 left-5 right-5">
                  <h3 className="mb-1 text-2xl font-bold font-bebas uppercase tracking-wider text-white">
                    {operator.name}
                  </h3>
                  <div className="flex items-center gap-1 text-white/90">
                    <MapPin className="size-3 text-[#C8F542]" />
                    <p className="truncate text-[10px] font-medium uppercase tracking-wider">
                      {operator.location}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    {courtsCount} {courtsCount === 1 ? 'Court' : 'Courts'} Available
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-gray-400 capitalize">From</span>
                    <span className="text-base font-bold text-gray-900">₱{minPrice}</span>
                    <span className="text-[11px] font-bold text-gray-500">/hr</span>
                  </div>
                </div>
                <div className="flex size-10 items-center justify-center rounded-full bg-black text-white transition-all group-hover:bg-[#C8F542] group-hover:text-black">
                  <ChevronRight className="size-5 transform rotate-[-45deg]" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  )
}
