import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

// Suppress noisy dependency warning from legacy url.parse() usage in transitive packages.
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...args) => {
  const codeFromWarning =
    typeof warning === 'object' && warning !== null
      ? warning.code
      : undefined;
  const codeFromArgs =
    typeof args[0] === 'string'
      ? args[0]
      : typeof args[1] === 'string'
        ? args[1]
        : undefined;
  const code = codeFromWarning ?? codeFromArgs;
  if (code === 'DEP0169') {
    return;
  }
  return originalEmitWarning(warning, ...args);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 5173);

const mimeTypes = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const FALLBACK_DESCRIPTION = 'Book your slot now.';
const FALLBACK_TITLE = 'Korte.ph - Easy Court Booking';

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

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getAbsoluteUrl = (req, reqUrl) => {
  const host = req.headers.host ?? `localhost:${port}`;
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : 'http';
  return `${protocol}://${host}${reqUrl}`;
};

const getUrlPath = (reqUrl) => (reqUrl ?? '/').split('?')[0] || '/';

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

const resolveApiBaseUrl = () => {
  const raw = String(process.env.API_URL ?? 'https://st-api.korte.ph').trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/\/api$/i, '');
  }
  return withoutTrailingSlash;
};

const extractRouteMeta = async (reqUrl) => {
  const urlPath = getUrlPath(reqUrl);
  const operatorMatch = urlPath.match(/^\/operator\/([^/?#]+)/);
  if (operatorMatch) {
    const operatorId = decodeURIComponent(operatorMatch[1]);
    const operatorMeta = mockOperatorMetaById.get(operatorId);
    if (operatorMeta) {
      return operatorMeta;
    }
    return null;
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

  const apiBaseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${apiBaseUrl}/api/venues/${venueId}`);
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

const buildSsrHead = ({ title, description, image, url }) => {
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

const sendFile = (res, filePath) =>
  new Promise((resolve, reject) => {
    const ext = path.extname(filePath);
    const type = mimeTypes[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('end', resolve)
      .pipe(res);
  });

const fileExists = async (filePath) => {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
};

let vite;
let template;
let render;

if (!isProd) {
  vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
} else {
  template = await fsp.readFile(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
  render = (await import('./dist/server/entry-server.js')).render;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url ?? '/';
  const urlPath = getUrlPath(reqUrl);
  const shouldSSR = /^\/(operator|venue)\//.test(urlPath);

  try {
    if (isProd) {
      const publicPath =
        urlPath === '/'
          ? path.resolve(__dirname, 'dist/client/index.html')
          : path.resolve(__dirname, 'dist/client', `.${urlPath}`);
      if (await fileExists(publicPath) && !publicPath.endsWith('index.html')) {
        await sendFile(res, publicPath);
        return;
      }
    }

    let htmlTemplate;

    if (!isProd) {
      htmlTemplate = await fsp.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
      htmlTemplate = await vite.transformIndexHtml(reqUrl, htmlTemplate);
    } else {
      htmlTemplate = template;
    }

    let appHtml = '';
    if (shouldSSR) {
      const renderFn = !isProd
        ? (await vite.ssrLoadModule('/src/entry-server.tsx')).render
        : render;
      const rendered = await renderFn(reqUrl);
      appHtml = typeof rendered === 'string' ? rendered : rendered.html;
    }
    let ssrHead = '';
    if (shouldSSR) {
      const routeMeta = await extractRouteMeta(reqUrl);
      const pageTitle = routeMeta?.name ? `${routeMeta.name} - Korte.ph` : FALLBACK_TITLE;
      const pageDescription = routeMeta?.description || FALLBACK_DESCRIPTION;
      const pageImage = routeMeta?.image || '';
      ssrHead = buildSsrHead({
        title: pageTitle,
        description: pageDescription,
        image: pageImage,
        url: getAbsoluteUrl(req, reqUrl),
      });
    }

    const normalizedTemplate = shouldSSR
      ? htmlTemplate.replace(/<title>[\s\S]*?<\/title>/i, '')
      : htmlTemplate;
    const html = normalizedTemplate
      .replace('<!--ssr-head-->', ssrHead)
      .replace('<!--ssr-outlet-->', appHtml ?? '');

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (error) {
    if (!isProd && vite) {
      vite.ssrFixStacktrace(error);
    }
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`SSR server running at http://localhost:${port}`);
});
