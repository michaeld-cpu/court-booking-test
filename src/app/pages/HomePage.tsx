import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockCourts, operators } from '../data/mockData'
import { SearchBar } from '../components/SearchBar'
import { Court, TimeSlot, Operator, CartItem } from '../types'
const BookingModal = React.lazy(() => import('../components/BookingModal').then(module => ({ default: module.BookingModal })))
import { ImageWithFallback } from '../components/figma/ImageWithFallback'
import { Card, CardContent } from '../components/ui/card'
import {
  Bookmark,
  MapPin,
  Map as MapIcon,
  Share2,
  Calendar,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  List,
  PanelBottom,
  Check,
} from 'lucide-react'
import { toast } from '@/app/lib/toast'
import { Icons } from '../components/ui/icons'
import { CourtCard } from '../components/CourtCard'
const VenueMapView = React.lazy(() => import('../components/VenueMapView').then(module => ({ default: module.VenueMapView })))
import { api } from '../lib/api'
import { addDays, addHours, format, isSameDay } from 'date-fns'
import { Button } from '../components/ui/button'
import { mapAvailabilitySlots } from '../lib/slotAvailability'
import { LOCAL_VENUE_BANNERS, resolveVenueBannerUrl } from '../lib/venueBanner'
import {
  getMinimumBookableDate,
  shouldShiftBookingDateToNextDay,
} from '../lib/bookingDate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import { Calendar as CalendarComponent } from '../components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { EmptyState } from '../components/EmptyState'

const AVAILABILITY_CACHE_KEY_PREFIX = 'courtbook_home_availability'

const readAvailabilityCache = (key: string) => {
  try {
    const cached = sessionStorage.getItem(key)
    if (!cached) return null
    const parsed = JSON.parse(cached)
    const operators = Array.isArray(parsed?.operators) ? parsed.operators : []
    const courts = Array.isArray(parsed?.courts) ? parsed.courts : []
    if (courts.length === 0) {
      return null
    }
    return {
      operators: operators as Operator[],
      courts: courts as Court[],
    }
  } catch {
    return null
  }
}

const writeAvailabilityCache = (
  key: string,
  payload: { operators: Operator[]; courts: Court[]; updatedAt?: number },
) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Ignore cache write failures.
  }
}

const getLatestAvailabilityCache = () => {
  try {
    let latest: { operators: Operator[]; courts: Court[]; updatedAt: number } | null =
      null
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (!key?.startsWith(`${AVAILABILITY_CACHE_KEY_PREFIX}:`)) {
        continue
      }
      const raw = sessionStorage.getItem(key)
      if (!raw) continue
      let parsed: any = null
      try {
        parsed = JSON.parse(raw)
      } catch {
        continue
      }
      const operators = Array.isArray(parsed?.operators) ? parsed.operators : []
      const courts = Array.isArray(parsed?.courts) ? parsed.courts : []
      if (courts.length === 0) continue
      const updatedAt = Number(parsed?.updatedAt ?? 0)
      if (!latest || updatedAt >= latest.updatedAt) {
        latest = {
          operators: operators as Operator[],
          courts: courts as Court[],
          updatedAt,
        }
      }
    }
    return latest
  } catch {
    return null
  }
}

const hasAvailabilityCacheEntries = () => {
  try {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(`${AVAILABILITY_CACHE_KEY_PREFIX}:`)) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

const clearHomeSessionStorage = () => {
  try {
    const keysToRemove = [
      'courtbook_selected_court_type',
    ]
    keysToRemove.forEach((key) => sessionStorage.removeItem(key))
    const availabilityKeys: string[] = []
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(`${AVAILABILITY_CACHE_KEY_PREFIX}:`)) {
        availabilityKeys.push(key)
      }
    }
    availabilityKeys.forEach((key) => sessionStorage.removeItem(key))
  } catch {
    // Ignore storage failures.
  }
}

interface HomePageProps {
  onAddToCart: (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
    courtId: string,
    date: Date,
  ) => void
  onPayNow: (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
    courtId: string,
    date: Date,
  ) => void
  bookmarkedOperatorIds: string[]
  onToggleBookmark: (operatorId: string, operator?: Operator) => void
  requireAuth: (
    action: () => void,
    options?: { runAfterLogin?: boolean },
  ) => boolean
  onAvailabilityLoaded?: () => void
  onEmptyStateChange?: (isEmpty: boolean) => void
  hasPendingBookings?: boolean
  cartItems?: CartItem[]
}

export function HomePage({
  onAddToCart,
  onPayNow,
  bookmarkedOperatorIds,
  onToggleBookmark,
  requireAuth,
  onAvailabilityLoaded,
  onEmptyStateChange,
  hasPendingBookings,
  cartItems = [],
}: HomePageProps) {
  const parsedDefaultVisibleCourts = Number.parseInt(
    String(import.meta.env.VITE_HOME_DEFAULT_VISIBLE_COURTS ?? '2'),
    10,
  )
  const defaultVisibleCourts = Number.isFinite(parsedDefaultVisibleCourts)
    ? Math.max(1, parsedDefaultVisibleCourts)
    : 2
  const navigate = useNavigate()
  const viewModeStorageKey = 'courtbook_home_view_mode'
  const [searchQuery, setSearchQuery] = useState('')
  const getSessionValue = (key: string) => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  }
  const getLocalValue = (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const storedCityAtMount =
    getLocalValue('courtbook_selected_city') ??
    getSessionValue('courtbook_selected_city')
  const storedDateAtMount = getSessionValue('courtbook_selected_date')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const storedDate = getSessionValue('courtbook_selected_date')
    const today = new Date()
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    if (storedDate) {
      const parsedDate = new Date(storedDate)
      if (!Number.isNaN(parsedDate.getTime())) {
        const parsedStart = new Date(parsedDate)
        parsedStart.setHours(0, 0, 0, 0)
        if (parsedStart < todayStart) {
          return today
        }
        return parsedDate
      }
    }
    return today
  })
  const [selectedCity, setSelectedCity] = useState(() => {
    return (
      getLocalValue('courtbook_selected_city') ??
      getSessionValue('courtbook_selected_city') ??
      'Dumaguete City'
    )
  })
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [selectedCourtType, setSelectedCourtType] = useState(() => {
    return getSessionValue('courtbook_selected_court_type') ?? 'All Courts'
  })
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>(() => {
    const stored = getLocalValue(viewModeStorageKey)
    if (stored === 'list' || stored === 'map') return stored
    return 'grid'
  })
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [availableCourts, setAvailableCourts] = useState<Court[]>([])
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(
    new Set(),
  )
  const [availableOperators, setAvailableOperators] = useState<Operator[]>([])
  const [userLocation, setUserLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [hasUserLocation, setHasUserLocation] = useState(false)
  const [isLocationResolved, setIsLocationResolved] = useState(false)
  const [availabilityRange, setAvailabilityRange] = useState<{
    start: Date
    end: Date
  } | null>(null)
  const [isLoadingCourts, setIsLoadingCourts] = useState(false)
  const [hasLoadedCourts, setHasLoadedCourts] = useState(false)
  const [isBackgroundUpdatingVenues, setIsBackgroundUpdatingVenues] =
    useState(false)
  const [isFilterChangeLoading, setIsFilterChangeLoading] = useState(false)
  const [forceSkeletonLoadingOnFilter, setForceSkeletonLoadingOnFilter] =
    useState(false)
  const [hasCompletedInitialAvailabilityFetch, setHasCompletedInitialAvailabilityFetch] =
    useState(false)
  const [hasInitialAvailabilityCache, setHasInitialAvailabilityCache] =
    useState(false)
  const [loadingCourtId, setLoadingCourtId] = useState<string | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isDesktopDatePickerOpen, setIsDesktopDatePickerOpen] = useState(false)
  const [isMobileDatePickerOpen, setIsMobileDatePickerOpen] = useState(false)

  const [isLocationPromptOpen, setIsLocationPromptOpen] = useState(false)
  const [mobileMapHeight, setMobileMapHeight] = useState<number | null>(null)
  const [availableLocations, setAvailableLocations] = useState<
    Array<{
      name: string
      description: string
      latitude: number
      longitude: number
    }>
  >([])
  const hasReportedAvailabilityLoadedRef = useRef(false)
  const previousFilterRef = useRef<{ city: string; dateKey: string } | null>(
    null,
  )
  const shouldFallbackFromStoredFiltersRef = useRef(
    Boolean(storedCityAtMount || storedDateAtMount),
  )
  const hasAppliedEmptyFallbackRef = useRef(false)
  const [selectedLocationCoords, setSelectedLocationCoords] = useState<{
    lat: number
    lng: number
  } | null>(() => {
    const storedCoords =
      getLocalValue('courtbook_selected_coords') ??
      getSessionValue('courtbook_selected_coords')
    if (!storedCoords) return null
    try {
      const parsed = JSON.parse(storedCoords)
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        return { lat: parsed.lat, lng: parsed.lng }
      }
    } catch {
      // Ignore parse errors
    }
    return null
  })
  const sessionKeys = {
    city: 'courtbook_selected_city',
    date: 'courtbook_selected_date',
    courtType: 'courtbook_selected_court_type',
  }
  const mapViewportRef = useRef<HTMLDivElement | null>(null)

  const hasHydratedInitialAvailabilityRef = useRef(false)

  useEffect(() => {
    if (hasHydratedInitialAvailabilityRef.current) {
      return
    }
    const cached = getLatestAvailabilityCache()
    if (!cached) {
      setHasInitialAvailabilityCache(false)
      hasHydratedInitialAvailabilityRef.current = true
      return
    }
    setHasInitialAvailabilityCache(true)
    setAvailableOperators(cached.operators)
    setAvailableCourts(cached.courts)
    setHasLoadedCourts(true)
    hasHydratedInitialAvailabilityRef.current = true
  }, [])

  useEffect(() => {
    const hasResults = hasLoadedCourts && availableCourts.length > 0

    sessionStorage.setItem(sessionKeys.city, selectedCity)
    localStorage.setItem(sessionKeys.city, selectedCity)

    sessionStorage.setItem(sessionKeys.courtType, selectedCourtType)
    if (hasResults) {
      sessionStorage.setItem(sessionKeys.date, selectedDate.toISOString())
    } else {
      sessionStorage.removeItem(sessionKeys.date)
    }

    if (selectedLocationCoords) {
      sessionStorage.setItem(
        'courtbook_selected_coords',
        JSON.stringify(selectedLocationCoords),
      )
      localStorage.setItem(
        'courtbook_selected_coords',
        JSON.stringify(selectedLocationCoords),
      )
    } else {
      sessionStorage.removeItem('courtbook_selected_coords')
      localStorage.removeItem('courtbook_selected_coords')
    }
  }, [
    selectedCity,
    selectedCourtType,
    selectedDate,
    selectedLocationCoords,
    hasLoadedCourts,
    availableCourts.length,
  ])

  useEffect(() => {
    if (!isLocationResolved) {
      return
    }
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    const previous = previousFilterRef.current
    if (!previous) {
      previousFilterRef.current = { city: selectedCity, dateKey }
      return
    }
    const hasChanged =
      previous.city !== selectedCity || previous.dateKey !== dateKey
    if (hasChanged) {
      shouldFallbackFromStoredFiltersRef.current = false
    }
    if (hasChanged && hasCompletedInitialAvailabilityFetch) {
      clearHomeSessionStorage()
    }
    previousFilterRef.current = { city: selectedCity, dateKey }
  }, [
    selectedCity,
    selectedDate,
    isLocationResolved,
    hasCompletedInitialAvailabilityFetch,
  ])

  useEffect(() => {
    try {
      localStorage.setItem(viewModeStorageKey, viewMode)
    } catch {
      // Ignore storage write errors
    }
  }, [viewMode, viewModeStorageKey])



  const getVenueBannerUrl = (venue: any, preferOptimized: boolean) => {
    const banner = venue?.banner ?? venue?.image ?? venue?.images?.[0]
    if (preferOptimized) {
      return banner?.optimized_url ?? banner?.url ?? null
    }
    return banner?.url ?? banner?.optimized_url ?? null
  }

  const normalizeAddress = (address?: string | null) => {
    if (!address) {
      return 'Unknown Address'
    }
    return address
      .replace(/,\s*philippines\b/gi, '')
      .replace(/\s*,\s*$/, '')
      .trim()
  }

  const deriveCity = (address?: string | null) => {
    if (!address) {
      return 'Unknown'
    }
    const parts = normalizeAddress(address)
      .split(',')
      .map((part) => part.trim())
    const cityMatch = parts.find((part) => /city|manila|cebu|davao/i.test(part))
    if (cityMatch) {
      return cityMatch
    }
    return parts[parts.length - 2] || parts[parts.length - 1] || 'Unknown'
  }

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
  ]

  const buildSlotsFromSummary = (
    totalSlots: number,
    availableSlots: number,
    price: number,
  ): TimeSlot[] => {
    if (!totalSlots || totalSlots <= 0) {
      return buildDefaultSlots(price)
    }

    const baseSlots = buildDefaultSlots(price)
    const slots: TimeSlot[] = []
    for (let index = 0; index < totalSlots; index += 1) {
      const base = baseSlots[index] ?? baseSlots[baseSlots.length - 1]
      slots.push({
        id: `s${index + 1}`,
        time: base.time,
        available: index < availableSlots,
        price: base.price,
      })
    }
    return slots
  }

  const renderDateLabel = (date: Date) => {
    if (isSameDay(date, new Date())) {
      return `Today - ${format(date, 'MMM d')}`
    }
    return format(date, 'EEE, MMM d')
  }

  const toVenueSlug = (operatorId: string, operatorName: string) => {
    const numericId = operatorId.startsWith('venue-')
      ? operatorId.replace('venue-', '')
      : operatorId
    const nameSlug = operatorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
    return `${numericId}-${nameSlug || 'venue'}`
  }

  // Carousel images
  const bannerImages = LOCAL_VENUE_BANNERS

  // Randomize banner image on initial load
  useEffect(() => {
    if (bannerImages.length === 0) return
    setCurrentImageIndex(Math.floor(Math.random() * bannerImages.length))
  }, [bannerImages.length])

  const requestUserLocation = (
    onSuccess?: () => void,
    options?: { fallbackToDumaguete?: boolean; showPromptOnError?: boolean },
  ) => {
    const fallbackToDumaguete = options?.fallbackToDumaguete ?? true
    const showPromptOnError = options?.showPromptOnError ?? false
    const dumagueteLocation = availableLocations.find((location) =>
      `${location.name} ${location.description}`.toLowerCase().includes('dumaguete'),
    )
    if (!navigator.geolocation) {
      if (!fallbackToDumaguete) {
        setIsLocationResolved(true)
        setIsLocationPromptOpen(showPromptOnError)
        return
      }
      setHasUserLocation(false)
      setUserLocation(null)
      if (fallbackToDumaguete && dumagueteLocation) {
        const coords = {
          lat: Number(dumagueteLocation.latitude),
          lng: Number(dumagueteLocation.longitude),
        }
        setSelectedCity(dumagueteLocation.name)
        setSelectedLocationCoords(coords)
        setUserLocation({ latitude: coords.lat, longitude: coords.lng })
      } else {
        setSelectedCity('All Locations')
        setSelectedLocationCoords(null)
      }
      setIsLocationResolved(true)
      setIsLocationPromptOpen(showPromptOnError)
      return
    }
    const geoOptions = {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600000,
    }
    // Pause availability fetches until browser geolocation resolves.
    setIsLocationResolved(false)
    setIsLocationPromptOpen(false)

    const resolveLocation = (attempt = 0) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          console.info('[HomePage] Browser geolocation success', {
            selectedCity: 'Current Location',
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: position.coords.accuracy,
          })
          setUserLocation(coords)
          setSelectedLocationCoords({
            lat: coords.latitude,
            lng: coords.longitude,
          })
          setHasUserLocation(true)
          setSelectedCity('Current Location')
          setIsLocationResolved(true)
          setIsLocationPromptOpen(false)
          try {
            sessionStorage.setItem(sessionKeys.city, 'Current Location')
            localStorage.setItem(sessionKeys.city, 'Current Location')
            sessionStorage.setItem(
              'courtbook_selected_coords',
              JSON.stringify({
                lat: coords.latitude,
                lng: coords.longitude,
              }),
            )
            localStorage.setItem(
              'courtbook_selected_coords',
              JSON.stringify({
                lat: coords.latitude,
                lng: coords.longitude,
              }),
            )
          } catch {
            // Ignore storage write failures.
          }
          onSuccess?.()
        },
        (geoError) => {
          const isPermissionDenied =
            geoError.code === geoError.PERMISSION_DENIED
          const isPositionUnavailable =
            geoError.code === geoError.POSITION_UNAVAILABLE
          const isLocationUnknown =
            /kCLErrorLocationUnknown/i.test(geoError.message ?? '')
          const isTransientLocationError =
            isPositionUnavailable || isLocationUnknown
          console.warn('[HomePage] Browser geolocation error', {
            code: geoError.code,
            message: geoError.message,
            isPermissionDenied,
            isTransientLocationError,
            attempt,
          })

          if (isTransientLocationError && attempt < 1) {
            window.setTimeout(() => resolveLocation(attempt + 1), 700)
            return
          }

          if (!fallbackToDumaguete) {
            setIsLocationResolved(true)
            setIsLocationPromptOpen(showPromptOnError && isPermissionDenied)
            return
          }
          setHasUserLocation(false)
          if (fallbackToDumaguete && dumagueteLocation) {
            const coords = {
              lat: Number(dumagueteLocation.latitude),
              lng: Number(dumagueteLocation.longitude),
            }
            setSelectedCity(dumagueteLocation.name)
            setSelectedLocationCoords(coords)
            setUserLocation({ latitude: coords.lat, longitude: coords.lng })
          } else {
            setUserLocation(null)
            setSelectedCity('All Locations')
            setSelectedLocationCoords(null)
          }
          setIsLocationResolved(true)
          setIsLocationPromptOpen(showPromptOnError && isPermissionDenied)
        },
        geoOptions,
      )
    }

    resolveLocation()
  }

  useEffect(() => {
    let isActive = true

    const findDumagueteLocation = (
      locations: Array<{
        name: string
        description: string
        latitude: number
        longitude: number
      }>,
    ) =>
      locations.find((location) =>
        `${location.name} ${location.description}`
          .toLowerCase()
          .includes('dumaguete'),
      )

    const parseStoredCoords = () => {
      const stored =
        getLocalValue('courtbook_selected_coords') ??
        getSessionValue('courtbook_selected_coords')
      if (!stored) {
        return null
      }
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
          return { lat: parsed.lat, lng: parsed.lng }
        }
      } catch {
        // Ignore parse errors
      }
      return null
    }

    const hydrateFromStoredLocation = (
      locations: Array<{
        name: string
        description: string
        latitude: number
        longitude: number
      }>,
    ) => {
      const storedCity =
        getLocalValue(sessionKeys.city) ?? getSessionValue(sessionKeys.city)
      const storedCoords = parseStoredCoords()

      if (!storedCity) {
        if (storedCoords) {
          setSelectedCity('Current Location')
          setSelectedLocationCoords(storedCoords)
          setUserLocation({
            latitude: storedCoords.lat,
            longitude: storedCoords.lng,
          })
          setHasUserLocation(true)
          setIsLocationResolved(true)
          return true
        }
        return false
      }

      if (storedCity === 'All Locations') {
        return false
      }

      if (storedCity === 'Current Location' && storedCoords) {
        setSelectedCity('Current Location')
        setSelectedLocationCoords(storedCoords)
        setUserLocation({
          latitude: storedCoords.lat,
          longitude: storedCoords.lng,
        })
        setHasUserLocation(true)
        setIsLocationResolved(true)
        return true
      }

      const matchedLocation = locations.find(
        (location) => location.name === storedCity,
      )
      if (!matchedLocation) {
        return false
      }

      const coords = {
        lat: Number(matchedLocation.latitude),
        lng: Number(matchedLocation.longitude),
      }
      setSelectedCity(storedCity)
      setSelectedLocationCoords(coords ?? null)
      setUserLocation(
        coords
          ? {
            latitude: coords.lat,
            longitude: coords.lng,
          }
          : null,
      )
      setHasUserLocation(false)
      setIsLocationResolved(true)
      return true
    }

    const bootstrapLocation = async () => {
      let locations: Array<{
        name: string
        description: string
        latitude: number
        longitude: number
      }> = []
      try {
        const response = await api.get('/api/locations')
        locations = Array.isArray(response.data?.data)
          ? response.data.data
          : Array.isArray(response.data)
            ? response.data
            : []
      } catch {
        // keep locations empty; proceed with geolocation fallback flow
      }

      if (!isActive) return
      setAvailableLocations(locations)

      if (hydrateFromStoredLocation(locations)) {
        return
      }
      const dumagueteLocation = findDumagueteLocation(locations)
      if (dumagueteLocation) {
        const dumagueteCoords = {
          lat: Number(dumagueteLocation.latitude),
          lng: Number(dumagueteLocation.longitude),
        }
        setSelectedCity(dumagueteLocation.name)
        setSelectedLocationCoords(dumagueteCoords)
        setUserLocation({
          latitude: dumagueteCoords.lat,
          longitude: dumagueteCoords.lng,
        })
        try {
          sessionStorage.setItem(sessionKeys.city, dumagueteLocation.name)
          localStorage.setItem(sessionKeys.city, dumagueteLocation.name)
          sessionStorage.setItem(
            'courtbook_selected_coords',
            JSON.stringify(dumagueteCoords),
          )
          localStorage.setItem(
            'courtbook_selected_coords',
            JSON.stringify(dumagueteCoords),
          )
        } catch {
          // Ignore storage write failures.
        }
      } else {
        setSelectedCity('All Locations')
        setSelectedLocationCoords(null)
        setUserLocation(null)
      }
      setHasUserLocation(false)
      setIsLocationResolved(true)
    }

    bootstrapLocation()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const fetchAvailability = async () => {
      if (!isLocationResolved) {
        return
      }
      try {
        const now = new Date()
        const shouldShiftToNextDay = shouldShiftBookingDateToNextDay(
          selectedDate,
          now,
        )
        if (shouldShiftToNextDay) {
          setSelectedDate(addDays(selectedDate, 1))
          return
        }
        const effectiveDate = shouldShiftToNextDay
          ? addDays(selectedDate, 1)
          : selectedDate

        const startDate = new Date(effectiveDate)
        if (isSameDay(effectiveDate, now)) {
          const nextHour = addHours(now, 1)
          startDate.setHours(nextHour.getHours(), 0, 0, 0)
        } else {
          startDate.setHours(0, 0, 0, 0)
        }
        const endDate = new Date(effectiveDate)
        endDate.setHours(23, 59, 59, 0)

        setAvailabilityRange({ start: startDate, end: endDate })
        const start = format(startDate, 'yyyy-MM-dd HH:mm:ss')
        const end = format(endDate, 'yyyy-MM-dd HH:mm:ss')

        const effectiveCoords = selectedLocationCoords ?? userLocation
        const latitude =
          selectedCity === 'All Locations'
            ? ''
            : effectiveCoords
              ? 'latitude' in effectiveCoords
                ? effectiveCoords.latitude
                : effectiveCoords.lat
              : ''
        const longitude =
          selectedCity === 'All Locations'
            ? ''
            : effectiveCoords
              ? 'longitude' in effectiveCoords
                ? effectiveCoords.longitude
                : effectiveCoords.lng
              : ''
        const isPageViewOnly = viewMode !== 'map'
        const availabilityCacheKey = [
          AVAILABILITY_CACHE_KEY_PREFIX,
          selectedCity,
          start,
          end,
          String(latitude),
          String(longitude),
        ].join(':')

        if (selectedCity === 'Current Location' && (!latitude || !longitude)) {
          if (isActive) {
            setIsLoadingCourts(false)
            setHasLoadedCourts(true)
          }
          return
        }
        if (selectedCity !== 'All Locations' && (!latitude || !longitude)) {
          if (isActive) {
            setIsLoadingCourts(false)
            setHasLoadedCourts(true)
          }
          return
        }

        console.info('[HomePage] Fetch availability params', {
          selectedCity,
          latitude,
          longitude,
          start,
          end,
        })

        const cachedAvailability = isPageViewOnly
          ? readAvailabilityCache(availabilityCacheKey)
          : null
        const hasCachedAvailability =
          Boolean(cachedAvailability) && (cachedAvailability?.courts.length ?? 0) > 0

        if (hasCachedAvailability && cachedAvailability) {
          setAvailableOperators(cachedAvailability.operators)
          setAvailableCourts(cachedAvailability.courts)
          setHasLoadedCourts(true)
          setIsLoadingCourts(false)
          setIsBackgroundUpdatingVenues(true)
        } else {
          setIsBackgroundUpdatingVenues(false)
          setIsLoadingCourts(true)
          setHasLoadedCourts(false)
        }

        try {
          const response = await api.get('/api/venues/availability', {
            params: {
              start,
              end,
              latitude,
              longitude,
            },
          })

          const venues = Array.isArray(response.data)
            ? response.data
            : (response.data?.data ?? [])
          if (!Array.isArray(venues) || venues.length === 0) {
            throw new Error('No venues from API')
          }

          const mappedOperators: Operator[] = []
          const mappedCourts: Court[] = []

          venues.forEach((venue: any) => {
            const operatorId = `venue-${venue.id}`
            const city = deriveCity(venue.address)
            const operatorName = venue.name ?? 'Unknown Venue'

            const normalizedAddress = normalizeAddress(venue.address)

            const coordPair = Array.isArray(venue.coordinates?.coordinates)
              ? venue.coordinates.coordinates
              : null
            const derivedCoordinates = {
              lat: coordPair ? coordPair[1] : null,
              lng: coordPair ? coordPair[0] : null,
            }

            const operator: Operator = {
              id: operatorId,
              name: operatorName,
              location: normalizedAddress,
              city: city,
              description: venue.description || '',
              amenities: [
                ...(venue.indoor ? ['Indoor'] : ['Outdoor']),
                ...(venue.is_covered ? ['Covered'] : []),
              ],
              rating: Number(venue.rating) || 4.5,
              phone: venue.phone || '',
              email: venue.email || '',
              operatingHours: '8:00 AM - 10:00 PM',
              image: getVenueBannerUrl(venue, false),
              profileImage: venue.profile_image || '',
              coordinates: derivedCoordinates,
              isCovered: venue.is_covered ? 'covered' : 'outdoor',
            }
            mappedOperators.push(operator)

            const courts = Array.isArray(venue.courts) ? venue.courts : []
            courts.forEach((court: any) => {
              const totalSlots = Number(court.total_slots) || 12
              const availableSlots = Number(court.available_slots) || totalSlots
              const basePrice = Number(court.price) || 300
              const normalizedAvailableSlotCount =
                Number(court.available_slots) ?? totalSlots
              const purposeLabel = court.purpose ?? court.type ?? 'pickleball'

              mappedCourts.push({
                id: String(court.id),
                name: court.name ?? `Court ${court.id}`,
                type: court.type ?? purposeLabel,
                purpose: purposeLabel,
                operatorId,
                operatorName,
                location: normalizedAddress,
                city,
                image: resolveVenueBannerUrl(
                  getVenueBannerUrl(venue, false),
                  `${operatorId}-${court.id}`,
                ),
                amenities: [],
                rating: 0,
                pricePerHour: basePrice,
                availableSlotCount: normalizedAvailableSlotCount,
                availableSlots: buildSlotsFromSummary(
                  totalSlots,
                  availableSlots,
                  basePrice,
                ),
              })
            })
          })

          if (isActive) {
            setAvailableOperators(mappedOperators)
            setAvailableCourts(mappedCourts)
            setHasLoadedCourts(true)
            if (isPageViewOnly && mappedCourts.length > 0) {
              writeAvailabilityCache(availabilityCacheKey, {
                operators: mappedOperators,
                courts: mappedCourts,
                updatedAt: Date.now(),
              })
            }
          }
        } catch (apiError) {
          console.warn('[HomePage] API fetch failed or returned no data', apiError)
          if (isActive) {
            setAvailableOperators([])
            setAvailableCourts([])
            setHasLoadedCourts(true)
          }
        }
      } catch (error) {
        toast.error('Unable to load venues', {
          description: 'Please try again in a moment.',
        })
        if (isActive) {
          setHasLoadedCourts(true)
          // No fallback to mock data even on top-level crash
          setAvailableOperators([])
          setAvailableCourts([])
        }
      } finally {
        if (isActive) {
          setIsLoadingCourts(false)
          setIsBackgroundUpdatingVenues(false)
          setIsFilterChangeLoading(false)
          setForceSkeletonLoadingOnFilter(false)
          setHasCompletedInitialAvailabilityFetch((prev) => prev || true)
        }
      }
    }

    fetchAvailability()

    return () => {
      isActive = false
    }
  }, [
    selectedDate,
    selectedCity,
    userLocation?.latitude,
    userLocation?.longitude,
    selectedLocationCoords?.lat,
    selectedLocationCoords?.lng,
    isLocationResolved,
    viewMode,
  ])

  useEffect(() => {
    if (hasLoadedCourts && !hasReportedAvailabilityLoadedRef.current) {
      hasReportedAvailabilityLoadedRef.current = true
      onAvailabilityLoaded?.()
    }
  }, [hasLoadedCourts, onAvailabilityLoaded])

  useEffect(() => {
    if (!hasLoadedCourts || isLoadingCourts) {
      return
    }
    if (availableCourts.length > 0) {
      return
    }
    if (
      !shouldFallbackFromStoredFiltersRef.current ||
      hasAppliedEmptyFallbackRef.current
    ) {
      return
    }

    hasAppliedEmptyFallbackRef.current = true
    shouldFallbackFromStoredFiltersRef.current = false

    setSelectedDate(getMinimumBookableDate())

    if (userLocation) {
      setSelectedCity('Current Location')
      setSelectedLocationCoords({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      })
      setHasUserLocation(true)
      setIsLocationResolved(true)
      return
    }

    const dumagueteLocation = availableLocations.find((location) =>
      `${location.name} ${location.description}`
        .toLowerCase()
        .includes('dumaguete'),
    )
    if (dumagueteLocation) {
      const dumagueteCoords = {
        lat: Number(dumagueteLocation.latitude),
        lng: Number(dumagueteLocation.longitude),
      }
      setSelectedCity(dumagueteLocation.name)
      setSelectedLocationCoords(dumagueteCoords)
      setUserLocation({
        latitude: dumagueteCoords.lat,
        longitude: dumagueteCoords.lng,
      })
      setHasUserLocation(false)
      setIsLocationResolved(true)
      return
    }

    setSelectedCity('All Locations')
    setSelectedLocationCoords(null)
    setUserLocation(null)
    setHasUserLocation(false)
    setIsLocationResolved(true)
  }, [
    hasLoadedCourts,
    isLoadingCourts,
    availableCourts.length,
    userLocation,
    availableLocations,
  ])

  useEffect(() => {
    onEmptyStateChange?.(hasLoadedCourts && availableCourts.length === 0)
  }, [hasLoadedCourts, availableCourts.length, onEmptyStateChange])

  useEffect(() => {
    if (viewMode !== 'map') {
      setMobileMapHeight(null)
      return
    }

    const updateMobileMapHeight = () => {
      if (window.innerWidth >= 768) {
        setMobileMapHeight(null)
        return
      }
      const mapViewport = mapViewportRef.current
      if (!mapViewport) return
      const rect = mapViewport.getBoundingClientRect()
      const nextHeight = Math.max(260, Math.floor(window.innerHeight - rect.top))
      setMobileMapHeight(nextHeight)
    }

    updateMobileMapHeight()
    window.addEventListener('resize', updateMobileMapHeight)
    window.addEventListener('orientationchange', updateMobileMapHeight)

    return () => {
      window.removeEventListener('resize', updateMobileMapHeight)
      window.removeEventListener('orientationchange', updateMobileMapHeight)
    }
  }, [viewMode])

  // Group courts by operator
  const courtsByOperator = useMemo(() => {
    const grouped = new globalThis.Map<
      string,
      {
        operatorName: string
        operatorId: string
        location: string
        city: string
        courts: Court[]
      }
    >()

    availableCourts.forEach((court) => {
      if (!grouped.has(court.operatorId)) {
        grouped.set(court.operatorId, {
          operatorName: court.operatorName,
          operatorId: court.operatorId,
          location: court.location,
          city: court.city,
          courts: [],
        })
      }
      grouped.get(court.operatorId)?.courts.push(court)
    })

    return Array.from(grouped.values())
  }, [availableCourts])

  const operatorById = useMemo(() => {
    return new globalThis.Map(
      availableOperators.map((operator) => [operator.id, operator]),
    )
  }, [availableOperators])

  const isUsingDummyData = useMemo(() => {
    return availableCourts === mockCourts || availableOperators === operators
  }, [availableCourts, availableOperators])

  const displayedCourtsByOperator = courtsByOperator

  const operatorsWithCoordinates = useMemo(() => {
    return displayedCourtsByOperator
      .map((group) => {
        const operator = operatorById.get(group.operatorId)
        const lat = Number(operator?.coordinates?.lat)
        const lng = Number(operator?.coordinates?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null
        }
        return {
          ...group,
          coordinates: { lat, lng },
          operator,
        }
      })
      .filter(
        (
          item,
        ): item is {
          operatorName: string
          operatorId: string
          location: string
          city: string
          courts: Court[]
          coordinates: { lat: number; lng: number }
          operator: Operator | undefined
        } => Boolean(item),
      )
  }, [displayedCourtsByOperator, operatorById])

  const mapCenter = useMemo(() => {
    const preferredCoords = selectedLocationCoords
      ? {
        lat: selectedLocationCoords.lat,
        lng: selectedLocationCoords.lng,
      }
      : userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : null

    if (preferredCoords) {
      return preferredCoords
    }

    if (operatorsWithCoordinates.length === 0) {
      return { lat: 9.3068, lng: 123.3054 }
    }

    const totals = operatorsWithCoordinates.reduce(
      (accumulator, operator) => ({
        lat: accumulator.lat + operator.coordinates.lat,
        lng: accumulator.lng + operator.coordinates.lng,
      }),
      { lat: 0, lng: 0 },
    )

    return {
      lat: totals.lat / operatorsWithCoordinates.length,
      lng: totals.lng / operatorsWithCoordinates.length,
    }
  }, [selectedLocationCoords, userLocation, operatorsWithCoordinates])

  const handleMapCenterChange = (next: { lat: number; lng: number }) => {
    const previous = selectedLocationCoords ?? mapCenter
    const distance =
      Math.abs(previous.lat - next.lat) + Math.abs(previous.lng - next.lng)
    if (distance < 0.0003) {
      return
    }
    setSelectedLocationCoords(next)
    setSelectedCity('Current Location')
    setHasUserLocation(false)
    setUserLocation({
      latitude: next.lat,
      longitude: next.lng,
    })
    setIsLocationResolved(true)
  }

  const fetchCourtSlots = async (court: Court, date: Date) => {
    setLoadingCourtId(court.id)
    setIsLoadingSlots(true)
    try {
      const venueId = court.operatorId.startsWith('venue-')
        ? court.operatorId.replace('venue-', '')
        : court.operatorId
      const courtId = court.id.startsWith('court-')
        ? court.id.replace('court-', '')
        : court.id
      const fallbackStart = new Date(date)
      fallbackStart.setHours(0, 0, 0, 0)
      const fallbackEnd = new Date(date)
      fallbackEnd.setHours(23, 59, 59, 0)
      const now = new Date()
      const startDate = new Date(availabilityRange?.start ?? fallbackStart)
      if (isSameDay(date, now)) {
        const oneHourAhead = addHours(now, 1)
        startDate.setHours(
          oneHourAhead.getHours(),
          oneHourAhead.getMinutes(),
          0,
          0,
        )
      }
      const endDate = new Date(availabilityRange?.end ?? fallbackEnd)

      const response = await api.get(`/api/venues/${venueId}/slots`, {
        params: {
          start: format(startDate, 'yyyy-MM-dd HH:mm:ss'),
          end: format(endDate, 'yyyy-MM-dd HH:mm:ss'),
          court_id: courtId,
        },
      })

      const data = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : []
      const courtSlots = data[0]?.slots ?? []
      const mappedSlots: TimeSlot[] = mapAvailabilitySlots(
        courtSlots,
        court.pricePerHour ?? 0,
      )

      setSelectedCourt({
        ...court,
        availableSlots:
          mappedSlots.length > 0 ? mappedSlots : court.availableSlots,
      })
      setIsBookingModalOpen(true)
    } catch (error) {
      toast.error('Unable to load slots', {
        description: 'Please try again in a moment.',
      })
      setSelectedCourt(court)
      setIsBookingModalOpen(true)
    } finally {
      setLoadingCourtId(null)
      setIsLoadingSlots(false)
    }
  }

  const handleBookCourt = (court: Court) => {
    if (
      !requireAuth(() => fetchCourtSlots(court, selectedDate), {
        runAfterLogin: false,
      })
    ) {
      return
    }
    fetchCourtSlots(court, selectedDate)
  }

  const handleOperatorClick = (
    operatorId: string,
    operator?: Operator,
    courts?: Court[],
  ) => {
    const nameForSlug =
      operator?.name ?? operatorById.get(operatorId)?.name ?? 'venue'
    const slug = toVenueSlug(operatorId, nameForSlug)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    navigate(`/venue/${slug}`, { state: { operator, courts } })
  }

  const handleAddToCartFromModal = (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
  ) => {
    if (selectedCourt) {
      const existingCourt = mockCourts.find(
        (court) => court.id === selectedCourt.id,
      )
      if (existingCourt) {
        Object.assign(existingCourt, {
          ...selectedCourt,
          availableSlots: selectedCourt.availableSlots,
        })
      } else {
        mockCourts.push({ ...selectedCourt })
      }
      onAddToCart(timeSlotFrom, timeSlotTo, selectedCourt.id, selectedDate)
    }
  }

  const handlePayNowFromModal = (
    timeSlotFrom: TimeSlot,
    timeSlotTo: TimeSlot,
  ) => {
    if (selectedCourt) {
      onPayNow(timeSlotFrom, timeSlotTo, selectedCourt.id, selectedDate)
    }
  }

  const handleBookingDateChange = (date: Date) => {
    setSelectedDate(date)
    if (selectedCourt) {
      fetchCourtSlots(selectedCourt, date)
    }
  }

  const shouldShowVenueSkeleton =
    isLoadingCourts &&
    !isBackgroundUpdatingVenues &&
    availableCourts.length === 0
  const isRefreshingAvailability =
    isLoadingCourts && availableCourts.length > 0

  return (
    <>
      {/* Mobile Header Banner - Layered Variant */}
      <header className="flex sm:hidden flex-col -mx-4 px-4 pt-2 pb-6 space-y-4">
        {/* Title Card */}
        <div className="bg-[#0D1F35] rounded-[1rem] p-8 pb-10 flex flex-col space-y-2.5 relative overflow-hidden border border-white/5">
          {/* Subtle accent light */}
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#C8F542]/10 to-transparent rounded-full pointer-events-none" />

          <div className="text-[#C8F542] text-[10px] font-regular tracking-[0.25em] uppercase opacity-90">
            Book Your Game
          </div>
          <h1
            className="text-[50px] font-medium leading-[0.95] text-white tracking-wide"
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              letterSpacing: '0.02em',
            }}
          >
            FIND YOUR <span className="text-[#C8F542]">COURT</span>
          </h1>
          <p className="text-gray-400 text-[13px] leading-relaxed font-regular"
            style={{ fontFamily: 'DM sans, sans-serif' }}>
            Browse and book courts near you. Play pickleball, badminton, tennis and more access the Philippines.
          </p>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-[1rem] shadow-sm sm:shadow-md border border-gray-200 overflow-hidden divide-y divide-gray-50">
          {/* Filter 1: City */}
          <Select
            value={selectedCity}
            onValueChange={(value) => {
              if (value === 'Current Location') {
                requestUserLocation(undefined, {
                  fallbackToDumaguete: false,
                  showPromptOnError: true,
                })
                return
              }
              setSelectedCity(value)
              if (value === 'All Locations') {
                setSelectedLocationCoords(null)
                setHasUserLocation(false)
                setUserLocation(null)
                setIsLocationResolved(true);
                return
              }
              const selectedLocation = availableLocations.find(
                (location) => location.name === value,
              )
              if (selectedLocation) {
                setSelectedLocationCoords({
                  lat: Number(selectedLocation.latitude),
                  lng: Number(selectedLocation.longitude),
                })
                setHasUserLocation(false)
                setIsLocationResolved(true)
              }
            }}
          >
            <SelectTrigger className="flex w-full items-center gap-4 p-5 py-10 hover:bg-gray-50/50 transition-colors border-0 bg-transparent h-auto shadow-none focus:ring-0 [&>svg]:hidden text-left group">
              <div className="bg-gray-50 flex items-center justify-center size-10 rounded-full shrink-0">
                <MapPin className="size-5 text-gray-500" />
              </div>
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wider mb-0.5 pointer-events-none">Location</span>
                <span className="text-gray-900 text-[15px] font-medium truncate pointer-events-none w-full text-left">
                  <SelectValue placeholder="Select city" />
                </span>
              </div>
              <div className="flex shrink-0">
                <ChevronDown className="size-5 text-gray-300 group-data-[state=open]:rotate-180 transition-transform" />
              </div>
            </SelectTrigger>
            <SelectContent className="z-[3000]">
              <SelectItem value="Current Location">
                {hasUserLocation
                  ? 'Current Location'
                  : 'Current Location'}
              </SelectItem>
              {availableLocations.map((location) => (
                <SelectItem key={location.name} value={location.name}>
                  {location.description || location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter 2: Date */}
          <Popover
            open={isMobileDatePickerOpen}
            onOpenChange={setIsMobileDatePickerOpen}
          >
            <PopoverTrigger asChild>
              <button className="flex w-full items-center gap-4 p-5 py-5 hover:bg-gray-50/50 transition-colors border-0 bg-transparent h-auto text-left group">
                <div className="bg-gray-50 flex items-center justify-center size-10 rounded-full shrink-0">
                  <Calendar className="size-5 text-gray-500" />
                </div>
                <div className="flex-1 flex flex-col items-start min-w-0">
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Date</span>
                  <span className="w-full text-left text-gray-900 text-[15px] font-medium truncate">
                    {isSameDay(selectedDate, new Date()) ? 'Today' : format(selectedDate, 'MMM d')}
                  </span>
                </div>
                <ChevronDown className="size-5 text-gray-300 group-data-[state=open]:rotate-180 transition-transform" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="z-[3000] w-auto p-0"
              align="end"
            >
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) return
                  setSelectedDate(date)
                  setIsMobileDatePickerOpen(false)
                }}
                disabled={{ before: new Date() }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Filter 3: Court Type */}
          <Select
            value={selectedCourtType}
            onValueChange={setSelectedCourtType}
          >
            <SelectTrigger className="flex w-full items-center gap-4 p-5 py-10 hover:bg-gray-50/50 transition-colors border-0 bg-transparent h-auto shadow-none focus:ring-0 [&>svg]:hidden text-left group">
              <div className="bg-gray-50 flex items-center justify-center size-10 rounded-full shrink-0">
                <LayoutGrid className="size-5 text-gray-500" />
              </div>
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className="text-gray-400 text-[10px] font-medium uppercase tracking-wider mb-0.5 pointer-events-none">Court Type</span>
                <span className="w-full text-left text-gray-900 text-[15px] font-medium truncate pointer-events-none">
                  <SelectValue placeholder="Select court type" />
                </span>
              </div>
              <div className="flex shrink-0">
                <ChevronDown className="size-5 text-gray-300 group-data-[state=open]:rotate-180 transition-transform" />
              </div>
            </SelectTrigger>
            <SelectContent className="z-[3000]">
              <SelectItem value="All Courts">All Courts</SelectItem>
              {Array.from(
                new Set(
                  availableCourts.map(
                    (court) => court.purpose ?? court.type ?? 'Others',
                  ),
                ),
              ).map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {purpose.charAt(0).toUpperCase() + purpose.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Desktop Header Banner - Original Style */}
      <header
        className="hidden sm:flex relative z-0 flex-col overflow-hidden text-white sm:mx-0 mt-6 md:mt-8 min-[1300px]:mt-10 rounded-lg min-h-[350px]"
      >
        <ImageWithFallback
          src={bannerImages[currentImageIndex]}
          alt="Banner"
          className="absolute inset-0 w-full h-full object-cover"
          priority
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-[#0F273A]/90 pointer-events-none"></div>

        {/* Top Content: Main Title & Text */}
        <div className="relative flex-1 flex flex-col justify-center items-center px-4 pt-10 pb-10 text-center">
          <div className="w-full max-w-3xl space-y-4">
            {/* Pre-title */}
            <div className="text-[#C8F542] text-xs md:text-sm font-regular tracking-[0.2em] uppercase mb-2 p-4">
              Book Your Game
            </div>

            {/* Title */}
            <h1
              className="text-6xl md:text-7xl lg:text-[90px] font-medium text-white drop-shadow-md leading-none"
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                letterSpacing: '-0.01em',
              }}
            >
              FIND YOUR <span className="text-[#C8F542]">COURT</span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-300 text-sm md:text-base lg:text-md max-w-xl mx-auto font-regular mt-4 px-0"
              style={{
                fontFamily: 'DM sans, sans-serif',
                letterSpacing: '0.02em',
              }}>
              Browse and book courts near you. Play pickleball, badminton,
              tennis and more across the Philippines.
            </p>
          </div>
        </div>

        {/* Bottom Content: Search Bar and Filters */}
        <div className="relative w-full bg-[#0D2032]/80 backdrop-blur-md border-t border-white/5 py-5">
          <div className="flex items-center justify-center max-w-md mx-auto divide-x divide-white/10 px-2">
            {/* Filter 1: City */}
            <div className="flex-1 px-2">
              <Select
                value={selectedCity}
                onValueChange={(value) => {
                  if (value === 'Current Location') {
                    requestUserLocation(undefined, {
                      fallbackToDumaguete: false,
                      showPromptOnError: true,
                    })
                    return
                  }
                  setSelectedCity(value)
                  if (value === 'All Locations') {
                    setSelectedLocationCoords(null)
                    setHasUserLocation(false)
                    setUserLocation(null)
                    setIsLocationResolved(true)
                    return
                  }
                  const selectedLocation = availableLocations.find(
                    (location) => location.name === value,
                  )
                  if (selectedLocation) {
                    setSelectedLocationCoords({
                      lat: Number(selectedLocation.latitude),
                      lng: Number(selectedLocation.longitude),
                    })
                    setHasUserLocation(false)
                    setIsLocationResolved(true)
                  }
                }}
              >
                <SelectTrigger className="w-full h-auto py-1 border-0 bg-transparent text-gray-200 hover:text-white px-2 gap-2 text-sm font-medium shadow-none focus:ring-0 [&>svg]:opacity-50">
                  <span className="flex items-center gap-2 flex-1">
                    <MapPin className="size-4 text-[#C8F542]" />
                    <SelectValue placeholder="Select city" />
                  </span>
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  <SelectItem value="Current Location">
                    {hasUserLocation
                      ? 'Current Location'
                      : 'Current Location'}
                  </SelectItem>
                  {availableLocations.map((location) => (
                    <SelectItem key={location.name} value={location.name}>
                      {location.description || location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter 2: Date */}
            <div className="flex-1 px-2">
              <Popover
                open={isDesktopDatePickerOpen}
                onOpenChange={setIsDesktopDatePickerOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full h-auto py-1 justify-start rounded-none border-0 bg-transparent hover:bg-transparent px-2 text-sm font-medium text-gray-200 hover:text-white focus:ring-0"
                  >
                    <Calendar className="size-4 text-[#C8F542] mr-2" />
                    <span className="truncate">{renderDateLabel(selectedDate)}</span>
                    <ChevronDown className="ml-auto size-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[3000] w-auto p-0"
                  align="start"
                >
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return
                      setSelectedDate(date)
                      setIsDesktopDatePickerOpen(false)
                    }}
                    disabled={{ before: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filter 3: Court Type */}
            <div className="flex-1 px-2">
              <Select
                value={selectedCourtType}
                onValueChange={setSelectedCourtType}
              >
                <SelectTrigger className="w-full h-auto py-1 border-0 bg-transparent text-gray-200 hover:text-white px-2 gap-2 text-sm font-medium shadow-none focus:ring-0 [&>svg]:opacity-50">
                  <span className="flex items-center gap-2 flex-1">
                    <LayoutGrid className="size-4 text-[#C8F542]" />
                    <SelectValue placeholder="Select court type" />
                  </span>
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  <SelectItem value="All Courts">All Courts</SelectItem>
                  {Array.from(
                    new Set(
                      availableCourts.map(
                        (court) => court.purpose ?? court.type ?? 'Others',
                      ),
                    ),
                  ).map((purpose) => (
                    <SelectItem key={purpose} value={purpose}>
                      {purpose.charAt(0).toUpperCase() + purpose.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <div className="pb-0 md:pb-1 pt-4.5 md:pt-10">
        <div className="mb-4 md:mb-6 px-0 flex flex-row items-center justify-between">
          <>
            <h2 className="text-sm sm:text-base font-semibold">
              {hasLoadedCourts
                ? (availableCourts.length > 0 || viewMode === 'map')
                  ? `${availableCourts.length} Court${availableCourts.length !== 1 ? 's' : ''}`
                  : <>&nbsp;</>
                : 'Loading courts...'}
            </h2>
            <div className="hidden md:flex items-center gap-1.5 bg-white border border-gray-100 pt-2 pb-2 shadow-sm p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex size-[26px] items-center justify-center rounded ${viewMode === 'grid'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
                aria-label="Grid view"
              >
                <PanelBottom className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex size-[26px] items-center justify-center rounded ${viewMode === 'list'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
                aria-label="List view"
              >
                <List className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex size-[26px] items-center justify-center rounded ${viewMode === 'map'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
                aria-label="Map view"
              >
                <MapIcon className="size-4" />
              </button>
            </div>
          </>
        </div>

        {viewMode === 'map' ? (
          <div
            className={`space-y-4 pb-3 md:pb-0 transition-opacity duration-200 ${isRefreshingAvailability
              ? 'opacity-45 pointer-events-none'
              : 'opacity-100'
              }`}
          >
            <div
              ref={mapViewportRef}
              className="overflow-hidden rounded-none border-y border-x-0 border-gray-200 bg-white md:rounded-lg md:border md:shadow-sm"
              style={mobileMapHeight ? { height: `${mobileMapHeight}px` } : undefined}
            >
              <React.Suspense fallback={<div className={mobileMapHeight ? 'h-full bg-gray-100 animate-pulse' : 'h-[320px] sm:h-[420px] bg-gray-100 animate-pulse'} />}>
                <VenueMapView
                  key={mobileMapHeight ? `mobile-map-${mobileMapHeight}` : 'map-default'}
                  center={mapCenter}
                  venues={operatorsWithCoordinates}
                  onCenterChange={handleMapCenterChange}
                  initialZoom={12}
                  heightClassName={mobileMapHeight ? 'h-full' : 'h-[320px] sm:h-[420px]'}
                  onVenueClick={(venue) => {
                    handleOperatorClick(
                      venue.operatorId,
                      operatorById.get(venue.operatorId),
                      displayedCourtsByOperator.find(
                        (group) => group.operatorId === venue.operatorId,
                      )?.courts,
                    )
                  }}
                />
              </React.Suspense>
            </div>



            <div>
              {shouldShowVenueSkeleton ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`map-venue-skeleton-${index}`}
                    className="flex items-center justify-between gap-3 border-b border-gray-200 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-2.5">
                      <div className="size-4 rounded-full bg-gray-200 animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
                        <div className="mt-2 h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="h-4 w-8 rounded bg-gray-200 animate-pulse" />
                      <div className="mt-1 h-3 w-10 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                ))
              ) : operatorsWithCoordinates.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
                  No venues found in this area.
                </div>
              ) : (
                operatorsWithCoordinates.map((operatorGroup) => (
                  <button
                    key={operatorGroup.operatorId}
                    type="button"
                    onClick={() =>
                      handleOperatorClick(
                        operatorGroup.operatorId,
                        operatorGroup.operator,
                        operatorGroup.courts,
                      )
                    }
                    className="flex w-full items-center justify-between gap-3 border-b border-gray-200 py-3 text-left transition-colors hover:bg-gray-50/60 last:border-b-0"
                  >
                    <div className="min-w-0 flex items-center gap-2.5 flex-1">
                      <MapPin className="size-4 shrink-0 text-red-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {operatorGroup.operatorName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {operatorGroup.location}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {operatorGroup.courts.reduce(
                          (total, court) =>
                            total +
                            (typeof court.availableSlotCount === 'number'
                              ? court.availableSlotCount
                              : court.availableSlots.filter(
                                (slot) => slot.available,
                              ).length),
                          0,
                        )}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">
                        slots
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : shouldShowVenueSkeleton ? (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 ${isUsingDummyData ? 'opacity-70' : ''}`}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={`skeleton-${index}`}
                className="overflow-hidden border-0 sm:border rounded-xl sm:rounded-lg flex flex-col gap-0 shadow-sm"
              >
                <div className="relative h-40 sm:h-44 lg:h-48 bg-gray-200 animate-pulse flex flex-col justify-end p-5">
                  <div className="absolute top-4 right-4 flex items-center gap-3">
                    <div className="size-8 rounded-full bg-black/10" />
                    <div className="size-8 rounded-full bg-black/10" />
                  </div>
                  <div className="h-8 w-2/3 rounded bg-black/10 mb-3 mt-auto" />
                  <div className="h-4 w-1/2 rounded bg-black/10" />
                </div>
                <CardContent className="py-0 px-5 sm:pb-3 flex-1 mt-4">
                  <div className="space-y-3 py-2">
                    {Array.from({ length: viewMode === 'list' ? 3 : 2 }).map((__, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-3"
                      >
                        <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
                        <div className="mt-2 h-3 w-1/3 rounded bg-gray-200 animate-pulse" />
                      </div>
                    ))}
                  </div>
                  <div className="mx-auto mt-3 h-3 w-16 rounded bg-gray-200 animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : hasLoadedCourts && availableCourts.length === 0 ? (
          <EmptyState
            wrapperClassName="min-h-[calc(100dvh-260px)] pb-[59px] md:min-h-[calc(100dvh-260px)] md:pb-0 flex items-center justify-center px-4 pt-0 pb-4"
            icon={
              <div className="rounded-full bg-blue-100 p-4">
                <LayoutGrid className="size-8 text-blue-600" />
              </div>
            }
            title="No courts found"
            description="Try adjusting your location, date, or court type filters."
          />
        ) : (
          <div
            className={`transition-opacity duration-200 ${isRefreshingAvailability
              ? 'opacity-45 pointer-events-none'
              : 'opacity-100'
              } ${viewMode === 'grid'
                ? 'grid grid-cols-1 gap-3 md:block md:columns-2 xl:columns-3 md:gap-6'
                : 'grid grid-cols-1 gap-3 md:gap-4'
              }`}
          >
            {displayedCourtsByOperator.map((operatorGroup, index) => {
              const operator = operatorById.get(operatorGroup.operatorId)
              const operatorImage =
                resolveVenueBannerUrl(
                  operator?.image,
                  operatorGroup.operatorId ?? operatorGroup.operatorName,
                )
              const isFallbackOperatorImage = LOCAL_VENUE_BANNERS.includes(
                operatorImage,
              )
              const isExpanded = expandedOperators.has(operatorGroup.operatorId)
              const venueInitial =
                operatorGroup.operatorName.trim().charAt(0).toUpperCase() || 'V'

              const handleShareClick = (
                e: React.MouseEvent<HTMLButtonElement>,
              ) => {
                e.stopPropagation()
                const nameForSlug = operator?.name ?? operatorGroup.operatorName
                const slug = toVenueSlug(operatorGroup.operatorId, nameForSlug)
                const operatorUrl = `${window.location.origin}/venue/${slug}`

                if (navigator.share) {
                  navigator
                    .share({
                      title: operatorGroup.operatorName,
                      text: `Check out ${operatorGroup.operatorName} on Korte.ph`,
                      url: operatorUrl,
                    })
                    .catch(() => { })
                } else {
                  navigator.clipboard.writeText(operatorUrl)
                  toast.success('Link copied to clipboard!')
                }
              }

              const courtsList = (
                <CardContent className="py-0 px-5 sm:pb-3 flex-1 ">
                  <div>
                    {operatorGroup.courts.map((court, index) => {
                      const isHidden = index >= defaultVisibleCourts
                      return (
                        <div
                          key={court.id}
                          className={`overflow-hidden transition-all duration-300 ease-out ${isHidden
                            ? 'hidden'
                            : 'max-h-32 opacity-100 translate-y-0'
                            }`}
                          aria-hidden={isHidden}
                        >
                          <CourtCard
                            court={court}
                            onBook={handleBookCourt}
                            onOperatorClick={() =>
                              handleOperatorClick(
                                court.operatorId,
                                operatorById.get(court.operatorId),
                                operatorGroup.courts,
                              )
                            }
                            isBooking={loadingCourtId === court.id}
                          />
                        </div>
                      )
                    })}
                  </div>
                  {operatorGroup.courts.length > defaultVisibleCourts && (
                    <button
                      type="button"
                      className="mt-5 mx-auto block text-xs text-gray-500 hover:text-gray-700 transition-colors no-underline"
                      onClick={() =>
                        handleOperatorClick(
                          operatorGroup.operatorId,
                          operator,
                          operatorGroup.courts,
                        )
                      }
                    >
                      {`+${operatorGroup.courts.length - defaultVisibleCourts} more`}
                    </button>
                  )}
                </CardContent>
              )

              return (
                <Card
                  key={operatorGroup.operatorId}
                  className={`overflow-hidden border-0 sm:border rounded-xl sm:rounded-lg flex flex-col gap-0 shadow-sm hover:shadow-lg transition-shadow md:mb-6 md:inline-block md:w-full md:break-inside-avoid ${index === displayedCourtsByOperator.length - 1
                    ? 'mb-3 md:mb-0'
                    : ''
                    }`}
                >
                  {viewMode === 'grid' ? (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handleOperatorClick(
                            operatorGroup.operatorId,
                            operator,
                            operatorGroup.courts,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            handleOperatorClick(
                              operatorGroup.operatorId,
                              operator,
                              operatorGroup.courts,
                            )
                          }
                        }}
                        className="relative h-40 sm:h-44 lg:h-48 overflow-hidden cursor-pointer group"
                      >
                        <ImageWithFallback
                          src={operatorImage}
                          alt={operator?.name ?? operatorGroup.operatorName}
                          className={`w-full h-full object-cover transition-transform duration-300 ${isFallbackOperatorImage
                            ? 'blur-md scale-110'
                            : 'group-hover:scale-105'
                            }`}
                          priority={index < 2}
                        />

                        {/* Gradient overlay for text readability */}
                        <div className="absolute inset-x-0 bottom-0 h-4/5 bg-gradient-to-t from-slate-900/100 via-slate-900/40 to-transparent pointer-events-none" />

                        {operator?.isCovered === 'covered' && (
                          <div className="absolute top-4 left-4 bg-[#ccff00] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-sm tracking-widest">
                            Covered
                          </div>
                        )}
                        <div className="absolute top-4 right-4 flex items-center gap-3">
                          <button
                            className="bg-black/70 rounded-full p-2 flex items-center justify-center shadow-sm hover:bg-black/80 transition-colors"
                            onClick={handleShareClick}
                            aria-label="Share"
                          >
                            <Share2 className="size-4 text-white" />
                          </button>
                          <button
                            className="bg-black/70 rounded-full p-2 flex items-center justify-center shadow-sm hover:bg-black/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleBookmark(
                                operatorGroup.operatorId,
                                operator,
                              )
                            }}
                            aria-label="Bookmark"
                          >
                            <Bookmark
                              className={`size-4 text-white ${bookmarkedOperatorIds.includes(operatorGroup.operatorId) ? 'fill-white' : ''}`}
                            />
                          </button>
                        </div>

                        {/* Text and Location Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-5 pt-10 flex w-full items-end justify-between gap-4">
                          <div className="min-w-0">
                            <div
                              className="line-clamp-1 text-3xl font-semibold uppercase tracking-tight text-white font-bebas"
                              style={{
                                letterSpacing: '1px',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                fontFamily: "var(--font-bebas), 'Bebas Neue', 'Arial Black', sans-serif"
                              }}
                            >
                              {operatorGroup.operatorName}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 drop-shadow-sm">
                              <MapPin className="size-4 flex-shrink-0 text-white/90" />
                              <p className="truncate text-[15px] font-medium text-white/90">
                                {operatorGroup.location}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="size-6 shrink-0 text-white/80 mb-1" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-gradient-to-b from-gray-100 to-white px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between gap-3 py-2">
                        <button
                          onClick={() =>
                            handleOperatorClick(
                              operatorGroup.operatorId,
                              operator,
                              operatorGroup.courts,
                            )
                          }
                          className="min-w-0 flex-1 text-left flex items-center gap-3"
                        >
                          {/* <div className="size-11 rounded-full bg-gray-900 text-white flex items-center justify-center text-base font-semibold">
                            {venueInitial}
                          </div> */}
                          <div className="min-w-0 ml-2 flex flex-1 items-center gap-2">
                            <div className="min-w-0">
                              <div
                                className="line-clamp-1 text-lg font-semibold font-alegreya"
                                style={{
                                  fontFamily: "var(--font-alegreya), 'Alegreya Sans', 'Helvetica Neue', Arial, sans-serif"
                                }}
                              >
                                {operatorGroup.operatorName}
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                                <MapPin className="size-3.5 text-gray-500 flex-shrink-0" />
                                <span className="truncate">
                                  {operatorGroup.location}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 mr-1">
                          <button
                            className="rounded-full p-2 flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={handleShareClick}
                            aria-label="Share"
                          >
                            <Share2 className="size-5 text-gray-700" />
                          </button>
                          <button
                            className="rounded-full p-2 flex items-center justify-center hover:bg-gray-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleBookmark(
                                operatorGroup.operatorId,
                                operator,
                              )
                            }}
                            aria-label="Bookmark"
                          >
                            <Bookmark
                              className={`size-5 ${bookmarkedOperatorIds.includes(operatorGroup.operatorId) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-700'}`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {courtsList}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Call to Action for Operators */}
      <section
        className={`py-12 max-w-[1720px] mx-auto ${hasLoadedCourts && availableCourts.length === 0 ? 'hidden sm:block' : ''
          }`}
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#0D2032] flex flex-col md:flex-row">
          <div className="absolute inset-0 pointer-events-none opacity-[0.08] z-0 flex items-center justify-center overflow-hidden">
            <Icons.brandAccent className="w-[180%] md:w-full h-auto text-white scale-100 md:scale-[0.6]transition-transform duration-500" />
          </div>
          {/* Left Content */}
          <div className="flex-1 p-8 md:p-12 lg:p-14 space-y-8">
            <div className="space-y-4">
              <h2
                className="text-5xl md:text-5xl lg:text-5xl font-bold text-white leading-none uppercase font-bebas"
                style={{ letterSpacing: '0.02em' }}
              >
                Are you a court operator?
              </h2>
              <p className="text-gray-400 text-s md:text-base lg:text-md max-w-xl font-regular font-dm-sans">
                Join Korte and reach thousands of players looking for courts. Grow
                your business with our easy-to-use booking platform.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {[
                'No setup fees',
                'Easy management',
                'Payment integration',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2.5 text-gray-300 group">
                  <Icons.brandedCheck className="size-5 text-[#C8F542]" />
                  <span className="text-xs md:text-sm font-medium capitalize">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Lime Section */}
          <div className="w-full md:w-[320px] bg-[#C8F542] py-12 px-6 md:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="relative w-full max-w-[180px] sm:max-w-[200px] flex flex-col items-center">
              <div className="relative w-[140px] sm:w-[160px] aspect-[4/5] border border-black/30 rounded-[1rem] p-1 pt-4 sm:pt-5 flex flex-col items-center justify-start bg-transparent transition-transform">
                <div className="text-7xl sm:text-7xl font-bold text-black leading-none font-bebas">
                  40+
                </div>
                {/* Label */}
                <div className="text-[12px] sm:text-[14px] font-medium uppercase tracking-[0.1em] text-black/80 mt-1">
                  Courts Listed
                </div>

                {/* Low Divider */}
                <div className="absolute left-0 right-0 top-[65%] border-t border-black/15" />
              </div>

              {/* Overlapping Pill Button */}
              <button
                onClick={() => navigate('/contact-us')}
                className="absolute -bottom-5 sm:-bottom-2 w-[120%] sm:w-[112%] bg-black text-white py-3.5 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl md:rounded-[1rem] flex items-center justify-center gap-2 shadow-2xl transition-all duration-300"
              >
                <span className="text-sm font-semibold">Join Korte</span>
                <ChevronRight className="size-4 sm:size-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Modal */}
      <React.Suspense fallback={null}>
        {isBookingModalOpen && selectedCourt && (
          <BookingModal
            court={selectedCourt}
            date={selectedDate}
            timeFrom=""
            timeTo=""
            isOpen={isBookingModalOpen}
            onClose={() => setIsBookingModalOpen(false)}
            onConfirm={handleAddToCartFromModal}
            onPayNow={handlePayNowFromModal}
            onDateChange={handleBookingDateChange}
            isLoadingSlots={isLoadingSlots}
            hasPendingBookings={hasPendingBookings}
            cartItems={cartItems}
          />
        )}
      </React.Suspense>

      <Dialog
        open={isLocationPromptOpen}
        onOpenChange={setIsLocationPromptOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable location services</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              Turn on location access to see courts near you. If you blocked
              access earlier, enable it in your browser settings and try again.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsLocationPromptOpen(false)}
              >
                Not now
              </Button>
              <Button
                onClick={() => {
                  setIsLocationPromptOpen(false)
                  requestUserLocation()
                }}
              >
                Allow location
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
