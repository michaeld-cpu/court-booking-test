import React, { useEffect, useRef, useState } from 'react'
import { Locate } from 'lucide-react'
import { toast } from '@/app/lib/toast'

export interface VenueMapItem {
  operatorId: string
  operatorName: string
  coordinates: {
    lat: number
    lng: number
  }
}

interface VenueMapViewProps {
  center: {
    lat: number
    lng: number
  }
  venues: VenueMapItem[]
  onCenterChange: (coords: { lat: number; lng: number }) => void
  onVenueClick: (venue: VenueMapItem) => void
  onRecenter?: () => void
  heightClassName?: string
  showDragHint?: boolean
  initialZoom?: number
}

const MAP_PROVIDER = (import.meta.env.VITE_MAP_PROVIDER ?? 'leaflet')
  .toString()
  .toLowerCase()
const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
).toString()
const MAPCN_DARK_TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const MAPCN_DARK_TILE_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO'

const isLeafletProvider = MAP_PROVIDER === 'leaflet'

const loadGoogleMapsScript = (apiKey: string) => {
  if ((window as any).google?.maps) {
    return Promise.resolve()
  }

  const globalKey = '__courtbook_google_maps_loader__'
  const existingPromise = (window as any)[globalKey]
  if (existingPromise) {
    return existingPromise
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps failed to load'))
    document.body.appendChild(script)
  })

  ;(window as any)[globalKey] = promise
  return promise
}

export function VenueMapView({
  center,
  venues,
  onCenterChange,
  onVenueClick,
  onRecenter,
  heightClassName = 'h-[320px] sm:h-[420px]',
  showDragHint = true,
  initialZoom = 13,
}: VenueMapViewProps) {
  const [isMapReady, setIsMapReady] = useState(false)
  const [isMapFallback, setIsMapFallback] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const onCenterChangeRef = useRef(onCenterChange)
  const onVenueClickRef = useRef(onVenueClick)
  const isProgrammaticMoveRef = useRef(false)

  const leafletMapRef = useRef<any>(null)
  const markerLayerRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const leafetInvalidateTimersRef = useRef<number[]>([])

  const googleMapRef = useRef<any>(null)
  const googleMapListenerRef = useRef<any>(null)
  const googleMarkersRef = useRef<any[]>([])

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange
  }, [onCenterChange])

  useEffect(() => {
    onVenueClickRef.current = onVenueClick
  }, [onVenueClick])

  const safeInvalidateLeafletSize = (targetMap?: any) => {
    const map = targetMap ?? leafletMapRef.current
    const container = mapContainerRef.current
    if (!map || !container || !container.isConnected) return
    if (!map._loaded || !map._mapPane) return
    try {
      map.invalidateSize()
    } catch {
      // Ignore transient invalidate errors during unmount/remount cycles.
    }
  }

  const buildGoogleEmbedUrl = (coords: { lat: number; lng: number }) => {
    return `https://maps.google.com/maps?hl=en&q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}&z=${initialZoom}&output=embed`
  }

  const buildLeafletFallbackMapUrl = (coords: { lat: number; lng: number }) => {
    const latPad = 0.02
    const lngPad = 0.02
    const left = coords.lng - lngPad
    const right = coords.lng + lngPad
    const top = coords.lat + latPad
    const bottom = coords.lat - latPad
    const bbox = `${left},${bottom},${right},${top}`
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${coords.lat},${coords.lng}`)}`
  }

  useEffect(() => {
    if (isLeafletProvider) {
      return undefined
    }

    let isMounted = true

    const loadGoogleMap = async () => {
      if (!mapContainerRef.current || googleMapRef.current) return

      setIsMapReady(false)
      setIsMapFallback(false)

      if (!GOOGLE_MAPS_API_KEY) {
        setIsMapFallback(true)
        setIsMapReady(true)
        return
      }

      await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
      if (!isMounted || !mapContainerRef.current || googleMapRef.current) return

      const google = (window as any).google
      const map = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom: initialZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      })

      googleMapRef.current = map
      googleMapListenerRef.current = map.addListener('idle', () => {
        if (isProgrammaticMoveRef.current) {
          isProgrammaticMoveRef.current = false
          return
        }

        const mapCenter = map.getCenter?.()
        if (!mapCenter) return

        onCenterChangeRef.current({
          lat: Number(mapCenter.lat().toFixed(6)),
          lng: Number(mapCenter.lng().toFixed(6)),
        })
      })

      setIsMapReady(true)
    }

    loadGoogleMap().catch(() => {
      setIsMapFallback(true)
      setIsMapReady(true)
      toast.error('Unable to load Google Maps', {
        description: 'Falling back to embedded map preview.',
      })
    })

    return () => {
      isMounted = false
      if (googleMapListenerRef.current?.remove) {
        googleMapListenerRef.current.remove()
      }
      googleMapListenerRef.current = null
      googleMarkersRef.current.forEach((marker) => marker.setMap(null))
      googleMarkersRef.current = []
      googleMapRef.current = null
      setIsMapReady(false)
    }
  }, [initialZoom])

  useEffect(() => {
    if (isLeafletProvider) {
      return undefined
    }
    if (!googleMapRef.current || !(window as any).google?.maps) return

    const map = googleMapRef.current
    const google = (window as any).google

    googleMarkersRef.current.forEach((marker) => marker.setMap(null))
    googleMarkersRef.current = []

    venues.forEach((venue) => {
      const marker = new google.maps.Marker({
        position: venue.coordinates,
        map,
        title: venue.operatorName,
      })
      marker.addListener('click', () => onVenueClickRef.current(venue))
      googleMarkersRef.current.push(marker)
    })
  }, [venues, isMapReady])

  useEffect(() => {
    if (isLeafletProvider || !googleMapRef.current) return
    const map = googleMapRef.current
    const mapCenter = map.getCenter?.()
    if (!mapCenter) return

    const distance =
      Math.abs(mapCenter.lat() - center.lat) + Math.abs(mapCenter.lng() - center.lng)

    if (distance > 0.0003) {
      isProgrammaticMoveRef.current = true
      map.setCenter(center)
    }
  }, [center.lat, center.lng])

  useEffect(() => {
    if (!isLeafletProvider) {
      return undefined
    }

    let isMounted = true

    const loadLeaflet = async () => {
      if (!mapContainerRef.current || leafletMapRef.current) return

      setIsMapReady(false)
      setIsMapFallback(false)

      if (!document.getElementById('leaflet-css')) {
        const css = document.createElement('link')
        css.id = 'leaflet-css'
        css.rel = 'stylesheet'
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(css)
      }

      if (!(window as any).L) {
        const scriptSources = [
          'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
          'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
        ]

        let loaded = false
        for (const source of scriptSources) {
          if (loaded || (window as any).L) {
            loaded = true
            break
          }
          await new Promise<void>((resolve) => {
            const script = document.createElement('script')
            script.src = source
            script.async = true
            script.onload = () => {
              loaded = true
              resolve()
            }
            script.onerror = () => resolve()
            document.body.appendChild(script)
          })
        }

        if (!loaded && !(window as any).L) {
          throw new Error('Leaflet failed to load')
        }
      }

      if (!isMounted || !mapContainerRef.current || leafletMapRef.current) return

      // Avoid initializing Leaflet against a zero-height container.
      let layoutAttempts = 0
      while (
        isMounted &&
        mapContainerRef.current &&
        mapContainerRef.current.clientHeight < 40 &&
        layoutAttempts < 20
      ) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => requestAnimationFrame(resolve))
        layoutAttempts += 1
      }
      if (!isMounted || !mapContainerRef.current || leafletMapRef.current) return

      const L = (window as any).L
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([center.lat, center.lng], initialZoom)

      const tileSources = [
        {
          // mapcn defaults to CARTO basemaps; use a dark style.
          url: MAPCN_DARK_TILE_URL,
          attribution: MAPCN_DARK_TILE_ATTRIBUTION,
        },
        {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '&copy; OpenStreetMap contributors',
        },
      ]

      const mountTileLayer = (index: number) => {
        const source = tileSources[index]
        if (!source) {
          setIsMapFallback(true)
          setIsMapReady(true)
          return
        }

        if (tileLayerRef.current) {
          map.removeLayer(tileLayerRef.current)
        }

        let tileErrorCount = 0
        const layer = L.tileLayer(source.url, {
          maxZoom: 19,
          attribution: source.attribution,
        })
        layer.on('load', () => {
          setIsMapReady(true)
        })
        layer.on('tileerror', () => {
          tileErrorCount += 1
          if (tileErrorCount >= 10) {
            mountTileLayer(index + 1)
          }
        })
        layer.addTo(map)
        tileLayerRef.current = layer
      }

      mountTileLayer(0)

      markerLayerRef.current = L.layerGroup().addTo(map)
      leafletMapRef.current = map
      safeInvalidateLeafletSize(map)
      leafetInvalidateTimersRef.current.push(
        window.setTimeout(() => safeInvalidateLeafletSize(map), 120),
      )
      leafetInvalidateTimersRef.current.push(
        window.setTimeout(() => safeInvalidateLeafletSize(map), 320),
      )

      map.on('moveend', () => {
        if (isProgrammaticMoveRef.current) {
          isProgrammaticMoveRef.current = false
          return
        }
        const nextCenter = map.getCenter()
        onCenterChangeRef.current({
          lat: Number(nextCenter.lat.toFixed(6)),
          lng: Number(nextCenter.lng.toFixed(6)),
        })
      })
    }

    loadLeaflet().catch(() => {
      setIsMapFallback(true)
      setIsMapReady(true)
      toast.error('Unable to load map', {
        description: 'Showing fallback preview.',
      })
    })

    return () => {
      isMounted = false
      leafetInvalidateTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      )
      leafetInvalidateTimersRef.current = []
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
      }
      leafletMapRef.current = null
      markerLayerRef.current = null
      tileLayerRef.current = null
      setIsMapReady(false)
    }
  }, [initialZoom])

  useEffect(() => {
    if (!isLeafletProvider || !leafletMapRef.current) return
    const map = leafletMapRef.current
    const current = map.getCenter()
    const distance =
      Math.abs(current.lat - center.lat) + Math.abs(current.lng - center.lng)

    if (distance > 0.0003) {
      isProgrammaticMoveRef.current = true
      map.setView([center.lat, center.lng], map.getZoom(), { animate: false })
    }
  }, [center.lat, center.lng])

  useEffect(() => {
    if (!isLeafletProvider || !markerLayerRef.current || !(window as any).L) return
    const L = (window as any).L
    markerLayerRef.current.clearLayers()

    venues.forEach((venue) => {
      const marker = L.circleMarker([venue.coordinates.lat, venue.coordinates.lng], {
        radius: 8,
        fillColor: '#C8F542',
        color: '#000000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      })
      marker
        .bindTooltip(venue.operatorName, {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'venue-pin-label',
        })
        .on('click', () => onVenueClickRef.current(venue))

      const ring = L.circleMarker([venue.coordinates.lat, venue.coordinates.lng], {
        radius: 13,
        color: '#C8F542',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0,
      })
      ring.on('click', () => onVenueClickRef.current(venue))
      markerLayerRef.current.addLayer(marker)
      markerLayerRef.current.addLayer(ring)
    })
  }, [venues, isMapReady])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      if (leafletMapRef.current) {
        safeInvalidateLeafletSize(leafletMapRef.current)
      }
      if (googleMapRef.current && (window as any).google?.maps) {
        ;(window as any).google.maps.event.trigger(googleMapRef.current, 'resize')
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [heightClassName])

  const isUsingGoogleEmbed = !isLeafletProvider && (isMapFallback || !GOOGLE_MAPS_API_KEY)

  return (
    <div className={`relative ${heightClassName}`}>
      {isUsingGoogleEmbed ? (
        <iframe
          title="Venue map"
          src={buildGoogleEmbedUrl(center)}
          className="h-full w-full border-0"
          loading="lazy"
          onLoad={() => setIsMapReady(true)}
        />
      ) : isLeafletProvider && isMapFallback ? (
        <iframe
          title="Venue map fallback"
          src={buildLeafletFallbackMapUrl(center)}
          className="h-full w-full border-0"
          loading="lazy"
          onLoad={() => setIsMapReady(true)}
        />
      ) : (
        <div ref={mapContainerRef} className="h-full w-full" />
      )}

      {!isMapReady && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm">
          Loading map
        </div>
      )}

      {showDragHint && !isUsingGoogleEmbed && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
          Drag map to update location and reload venues
        </div>
      )}

      {onRecenter && isMapReady && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRecenter()
          }}
          className="absolute bottom-6 right-3 z-[1000] flex size-10 items-center justify-center rounded-full bg-white shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
          aria-label="Recenter to my location"
        >
          <Locate className="size-5 text-gray-700" />
        </button>
      )}
    </div>
  )
}
