export const LOCAL_VENUE_BANNERS = [
  '/imgs/bannerbg.png',
]

const toSeedHash = (seed: string) => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const getFallbackVenueBanner = (seed?: string) => {
  if (!seed) {
    return LOCAL_VENUE_BANNERS[Math.floor(Math.random() * LOCAL_VENUE_BANNERS.length)]
  }
  return LOCAL_VENUE_BANNERS[toSeedHash(seed) % LOCAL_VENUE_BANNERS.length]
}

export const resolveVenueBannerUrl = (
  candidate: string | null | undefined,
  seed?: string,
) => {
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate
  }
  return getFallbackVenueBanner(seed)
}

