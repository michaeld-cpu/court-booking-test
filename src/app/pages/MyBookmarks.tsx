import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { operators } from '../data/mockData';
import { Card } from '../components/ui/card';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Bookmark, ChevronRight, ListFilter, MapPin, Share2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Operator } from '../types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { resolveVenueBannerUrl } from '../lib/venueBanner';
import { toast } from '@/app/lib/toast';
import { EmptyState } from '../components/EmptyState';

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
      <EmptyState
        icon={
          <div className="rounded-full bg-blue-100 p-4">
            <Bookmark className="size-8 text-blue-600" />
          </div>
        }
        title="No saved venues yet"
        description={
          <>
            Save your favorite venues by<br />clicking the bookmark icon.
          </>
        }
        action={
          <Button asChild className="w-full sm:w-auto">
            <Link to="/">Browse Courts</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="pt-0 md:pt-4 pb-0 md:pb-8 min-h-svh">
      <div className="mb-0 md:mb-3 flex items-center justify-between gap-3 py-4 sm:py-5 md:py-2 lg:py-2 bg-neutral-900 text-white sm:px-0 sm:bg-transparent sm:text-inherit">
        <h1
          className="text-xl md:text-2xl font-semibold text-white sm:text-inherit"
          style={{ fontFamily: 'Alegreya Sans, sans-serif', letterSpacing: '0.02em' }}
        >
          Saved
        </h1>
        <Select
          value={sortBy}
          onValueChange={(value: 'date_added' | 'name') => setSortBy(value)}
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
            <SelectItem value="date_added">
              Date Added
            </SelectItem>
            <SelectItem value="name">
              Name
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
        {sortedBookmarkedOperators.map((operator, index) => (
          <Card
            key={operator.id}
            className={`overflow-hidden border-0 sm:border rounded-none sm:rounded-lg flex flex-col gap-0 shadow-sm hover:shadow-lg transition-shadow ${
              index === sortedBookmarkedOperators.length - 1
                ? 'mb-3 md:mb-0'
                : ''
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleOperatorClick(operator)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleOperatorClick(operator)
                }
              }}
              className="relative h-42 sm:h-45 lg:h-50 overflow-hidden cursor-pointer group"
            >
              <ImageWithFallback
                src={resolveVenueBannerUrl(operator.image, operator.id)}
                alt={operator.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  className="bg-black/60 backdrop-blur-sm rounded-full p-2 flex items-center justify-center shadow-md hover:bg-black/70 transition-colors"
                  onClick={(event) => void handleShareClick(event, operator)}
                  aria-label="Share"
                >
                  <Share2 className="size-4 text-white" />
                </button>
                <button
                  className="bg-black/60 backdrop-blur-sm rounded-full p-2 flex items-center justify-center shadow-md hover:bg-black/70 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleBookmark(operator.id, operator)
                  }}
                  aria-label="Bookmark"
                >
                  <Bookmark className="size-4 fill-yellow-400 text-yellow-400" />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-b from-gray-100 to-white px-6 pt-4 pb-2.5">
              <button
                onClick={() => handleOperatorClick(operator)}
                className="flex w-full min-w-0 items-center justify-between gap-2 text-left transition-colors hover:text-blue-600"
              >
                <div className="min-w-0">
                  <div
                    className="truncate text-lg md:text-xl font-semibold"
                    style={{ fontFamily: 'Alegreya Sans, sans-serif' }}
                  >
                    {operator.name}
                  </div>
                  <div className="mb-2 mt-1 flex items-center gap-1">
                    <MapPin className="size-3.5 flex-shrink-0 text-gray-500" />
                    <p className="truncate text-left text-xs text-gray-600">
                      {operator.location}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-gray-500 -mr-1" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
