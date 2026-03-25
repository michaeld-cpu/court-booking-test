import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FALLBACK_DESCRIPTION = 'Book your slot now.';
const FALLBACK_TITLE = 'Korte.ph - Easy Court Booking';
const resolveApiBaseUrl = () => {
  const raw = String(process.env.API_URL ?? 'https://st-api.korte.ph').trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/\/api$/i, '');
  }
  return withoutTrailingSlash;
};
const API_BASE_URL = resolveApiBaseUrl();

const mockOperatorMetaById = new Map([
  [
    'op1',
    {
      name: 'Dumaguete Sports Hub',
      description:
        'Premier sports facility in Dumaguete offering basketball, pickleball, and badminton courts. We provide top-notch facilities with excellent amenities for athletes and sports enthusiasts.',
      image:
        'https://images.unsplash.com/photo-1759352642316-25f20e12bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcG9ydHMlMjBmYWNpbGl0eSUyMGJ1aWxkaW5nfGVufDF8fHx8MTc2NjEwNjI0N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
  [
    'op2',
    {
      name: 'Valencia Sports Complex',
      description:
        'Modern indoor sports complex featuring air-conditioned badminton courts, outdoor beach volleyball, and complete amenities. Perfect for both casual and competitive play.',
      image:
        'https://images.unsplash.com/photo-1705593136686-d5f32b611aa9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcG9ydHMlMjBjb21wbGV4JTIwZXh0ZXJpb3J8ZW58MXx8fHwxNzY2MTI5ODMyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
  [
    'op3',
    {
      name: 'Negros Oriental Tennis Club',
      description:
        'Exclusive tennis club with professional-grade courts, coaching services, and pro shop. Ideal for tennis enthusiasts of all skill levels.',
      image:
        'https://images.unsplash.com/photo-1726035165266-90169b3896b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjbHViJTIwYnVpbGRpbmd8ZW58MXx8fHwxNzY2MTI5ODMyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
  [
    'op4',
    {
      name: 'Cebu Sports Arena',
      description:
        'State-of-the-art indoor basketball facility in the heart of Cebu City. Features climate-controlled courts with professional equipment and amenities.',
      image:
        'https://images.unsplash.com/photo-1759722127760-ed26284e96e4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzcG9ydHMlMjBjb21wbGV4JTIwZXh0ZXJpb3J8ZW58MXx8fHwxNzY2MTMwNTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
  [
    'op5',
    {
      name: 'Manila Pickleball Hub',
      description:
        'Premium pickleball facility in BGC with multiple indoor courts, pro shop, and cafe. The ultimate destination for pickleball enthusiasts in Metro Manila.',
      image:
        'https://images.unsplash.com/photo-1761644273884-83839f8f22e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWNrbGViYWxsJTIwZmFjaWxpdHklMjBpbmRvb3J8ZW58MXx8fHwxNzY2MTMwNTQ0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
  [
    'op6',
    {
      name: 'Davao Badminton Center',
      description:
        'Spacious badminton center with multiple indoor courts, equipment rental, and friendly staff. Perfect venue for practice, tournaments, and recreational play.',
      image:
        'https://images.unsplash.com/photo-1726035165266-90169b3896b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWRtaW50b24lMjBjZW50ZXIlMjBidWlsZGluZ3xlbnwxfHx8fDE3NjYxMzA1NDR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  ],
]);

let cachedTemplate = null;
let cachedRender = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const parseVenueSlug = (slug = '') => {
  const value = String(slug ?? '').trim();
  const numericMatch = value.match(/^(\d+)(?:-|$)/);
  if (!numericMatch) {
    return { venueId: null, venueNameFromSlug: null };
  }
  const venueId = numericMatch[1];
  const slugName = value.slice(numericMatch[0].length).trim();
  const venueNameFromSlug = slugName
    ? slugName
        .split('-')
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join(' ')
    : null;
  return { venueId, venueNameFromSlug };
};

const resolveVenueMetaImage = (venue) => {
  const firstImage = Array.isArray(venue?.images) ? venue.images[0] : null;
  return (
    firstImage?.optimized_url ??
    firstImage?.url ??
    venue?.banner?.optimized_url ??
    venue?.banner?.url ??
    venue?.image?.optimized_url ??
    venue?.image?.url ??
    venue?.banner ??
    venue?.image ??
    ''
  );
};

const resolveVenueMetaDescription = (venue) => {
  const description = String(venue?.description ?? '').trim();
  if (description) {
    return description;
  }
  const address = String(venue?.address ?? '').trim();
  if (address) {
    return address;
  }
  return FALLBACK_DESCRIPTION;
};

const extractRouteMeta = async (urlPath) => {
  const operatorMatch = urlPath.match(/^\/operator\/([^/?#]+)/);
  if (operatorMatch) {
    const operatorId = decodeURIComponent(operatorMatch[1]);
    return mockOperatorMetaById.get(operatorId) ?? null;
  }

  const venueMatch = urlPath.match(/^\/venue\/([^/?#]+)/);
  if (!venueMatch) {
    return null;
  }

  const slug = decodeURIComponent(venueMatch[1]);
  const { venueId, venueNameFromSlug } = parseVenueSlug(slug);
  if (!venueId) {
    return venueNameFromSlug
      ? { name: venueNameFromSlug, description: '', image: '' }
      : null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/venues/${venueId}`);
    if (!response.ok) {
      return venueNameFromSlug
        ? { name: venueNameFromSlug, description: '', image: '' }
        : null;
    }
    const payload = await response.json();
    const venue = payload?.data ?? payload;
    if (!venue) {
      return venueNameFromSlug
        ? { name: venueNameFromSlug, description: '', image: '' }
        : null;
    }
    return {
      name: venue.name ?? venueNameFromSlug ?? '',
      description: resolveVenueMetaDescription(venue),
      image: resolveVenueMetaImage(venue),
    };
  } catch {
    return venueNameFromSlug
      ? { name: venueNameFromSlug, description: '', image: '' }
      : null;
  }
};

const buildHead = ({ title, description, image, url }) => {
  const safeTitle = escapeHtml(title || FALLBACK_TITLE);
  const safeDescription = escapeHtml(description || FALLBACK_DESCRIPTION);
  const safeImage = escapeHtml(image || '');
  const safeUrl = escapeHtml(url || '');

  const imageTags = safeImage
    ? `\n<meta property="og:image" content="${safeImage}" />\n<meta name="twitter:image" content="${safeImage}" />`
    : '';

  return [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescription}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta property="og:url" content="${safeUrl}" />`,
    `<meta name="twitter:card" content="${safeImage ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDescription}" />${imageTags}`,
  ].join('\n');
};

const getAbsoluteUrl = (req, urlPath) => {
  const host = req.headers.host ?? 'localhost';
  const protoHeader = req.headers['x-forwarded-proto'];
  const protoRaw = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const protocol = protoRaw ? protoRaw.split(',')[0].trim() : 'https';
  return `${protocol}://${host}${urlPath}`;
};

const loadSsrAssets = async () => {
  if (!cachedTemplate) {
    const templatePath = path.join(process.cwd(), 'dist/client/index.html');
    cachedTemplate = await fs.readFile(templatePath, 'utf-8');
  }

  if (!cachedRender) {
    const serverEntryPath = path.join(process.cwd(), 'dist/server/entry-server.js');
    const moduleUrl = pathToFileURL(serverEntryPath).href;
    cachedRender = (await import(moduleUrl)).render;
  }
};

const getPathFromQuery = (queryPath) => {
  const rawValue = Array.isArray(queryPath) ? queryPath[0] : queryPath;
  if (!rawValue) {
    return '/';
  }
  return rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
};

export default async function handler(req, res) {
  try {
    const routePath = getPathFromQuery(req.query?.path);
    if (!/^\/(operator|venue)\//.test(routePath)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Bad Request');
      return;
    }

    await loadSsrAssets();
    const rendered = await cachedRender(routePath);
    const appHtml = typeof rendered === 'string' ? rendered : rendered?.html ?? '';

    const routeMeta = await extractRouteMeta(routePath);
    const title = routeMeta?.name ? `${routeMeta.name} - Korte.ph` : FALLBACK_TITLE;
    const description = routeMeta?.description || FALLBACK_DESCRIPTION;
    const image = routeMeta?.image || '';
    const head = buildHead({
      title,
      description,
      image,
      url: getAbsoluteUrl(req, routePath),
    });

    const html = cachedTemplate
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace('<!--ssr-head-->', head)
      .replace('<!--ssr-outlet-->', appHtml);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('SSR render failed');
  }
}
