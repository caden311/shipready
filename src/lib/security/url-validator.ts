const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
  'instance-data',
]);

const BLOCKED_TLDS = ['.local', '.localhost', '.internal', '.corp', '.home', '.lan'];

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^198\.1[89]\./,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  url?: URL;
}

export function validateUrl(input: string): ValidationResult {
  let url: URL;
  try {
    // Add protocol if missing
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'https://' + input;
    }
    url = new URL(input);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please enter a valid URL.' };
  }

  // Protocol whitelist
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  // Port restriction
  if (url.port && url.port !== '80' && url.port !== '443') {
    return { valid: false, error: 'Only standard ports (80, 443) are allowed.' };
  }

  const hostname = url.hostname.toLowerCase();

  // Blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: 'This URL cannot be scanned for security reasons.' };
  }

  // Blocked TLDs
  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      return { valid: false, error: 'This URL cannot be scanned for security reasons.' };
    }
  }

  // Private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Private and internal IP addresses cannot be scanned.' };
    }
  }

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254') {
    return { valid: false, error: 'This URL cannot be scanned for security reasons.' };
  }

  // Must have a valid hostname with a dot (no bare words)
  if (!hostname.includes('.')) {
    return { valid: false, error: 'Please enter a full URL with a domain name.' };
  }

  return { valid: true, url };
}

export async function fetchWithSafety(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<Response> {
  const { timeoutMs = 8000, maxBytes = 2 * 1024 * 1024 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'ShipReady-SEO-Scanner/1.0 (+https://vientapps.com/tools/seo-check/)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    return response;
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The target URL took too long to respond (8 second timeout).');
    }
    throw err;
  }
}

export async function fetchFollowingRedirects(
  startUrl: string,
  maxHops: number = 3
): Promise<Response> {
  let currentUrl = startUrl;

  for (let i = 0; i < maxHops; i++) {
    const response = await fetchWithSafety(currentUrl);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Redirect response missing Location header.');
      }

      const nextUrl = new URL(location, currentUrl).toString();
      const validation = validateUrl(nextUrl);
      if (!validation.valid) {
        throw new Error(`Redirect target blocked: ${validation.error}`);
      }

      currentUrl = nextUrl;
      continue;
    }

    // Attach final URL info to the response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers([
        ...Array.from(response.headers.entries()),
        ['x-shipready-final-url', currentUrl],
      ]),
    });
  }

  throw new Error(`Too many redirects (max ${maxHops}).`);
}
