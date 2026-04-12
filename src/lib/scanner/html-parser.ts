import type { ParsedSEOData } from './types';

export function createEmptyParsedData(): ParsedSEOData {
  return {
    title: null,
    metaDescription: null,
    charset: false,
    viewport: null,
    htmlLang: null,
    canonical: null,
    favicon: false,
    ogTags: {},
    twitterTags: {},
    h1s: [],
    headings: [],
    images: [],
    jsonLd: [],
    scripts: [],
    links: [],
    anchors: [],
    bodyTextLength: 0,
    noindex: false,
    xRobotsTag: null,
    responseHeaders: {},
    finalUrl: '',
    statusCode: 0,
  };
}

function getAttr(tag: string, attr: string): string | null {
  // Match attr="value", attr='value', or attr=value
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return decodeHtmlEntities(m[1] ?? m[2] ?? m[3]);
}

function hasAttr(tag: string, attr: string): boolean {
  // Check if attribute exists (even without value, like "async" or "defer")
  const re = new RegExp(`\\b${attr}(?:\\s*=|[\\s>])`, 'i');
  return re.test(tag) || new RegExp(`\\b${attr}\\s*$`, 'i').test(tag);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function parseHTML(response: Response, finalUrl: string): Promise<ParsedSEOData> {
  const data = createEmptyParsedData();
  data.finalUrl = finalUrl;
  data.statusCode = response.status;

  // Capture response headers
  for (const [key, value] of response.headers.entries()) {
    data.responseHeaders[key.toLowerCase()] = value;
  }

  // Check X-Robots-Tag header
  data.xRobotsTag = response.headers.get('x-robots-tag');
  if (data.xRobotsTag?.toLowerCase().includes('noindex')) {
    data.noindex = true;
  }

  // Read body with size limit (2MB)
  const maxBytes = 2 * 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) {
    return data;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    chunks.push(value);
    if (totalBytes > maxBytes) {
      reader.cancel();
      break;
    }
  }

  const decoder = new TextDecoder();
  const html = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();

  // Split head and body
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : '';
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;

  // HTML lang
  const htmlTagMatch = html.match(/<html[^>]*>/i);
  if (htmlTagMatch) {
    data.htmlLang = getAttr(htmlTagMatch[0], 'lang');
  }

  // Title
  const titleMatch = headHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    data.title = stripTags(titleMatch[1]).trim();
  }

  // Meta tags
  const metaRegex = /<meta\s[^>]*?\/?>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const tag = metaMatch[0];
    const name = getAttr(tag, 'name')?.toLowerCase();
    const property = getAttr(tag, 'property')?.toLowerCase();
    const httpEquiv = getAttr(tag, 'http-equiv')?.toLowerCase();
    const content = getAttr(tag, 'content');
    const charsetAttr = getAttr(tag, 'charset');

    if (charsetAttr) data.charset = true;
    if (httpEquiv === 'content-type' && content?.includes('charset')) data.charset = true;
    if (name === 'description' && content) data.metaDescription = content;
    if (name === 'viewport' && content) data.viewport = content;
    if (name === 'robots' && content?.toLowerCase().includes('noindex')) data.noindex = true;

    if (property?.startsWith('og:') && content) data.ogTags[property] = content;
    if (name?.startsWith('twitter:') && content) data.twitterTags[name] = content;
    if (property?.startsWith('twitter:') && content) data.twitterTags[property] = content;
  }

  // Link tags
  const linkRegex = /<link\s[^>]*?\/?>/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const tag = linkMatch[0];
    const rel = getAttr(tag, 'rel')?.toLowerCase() || '';
    const href = getAttr(tag, 'href') || '';
    const hreflang = getAttr(tag, 'hreflang') || undefined;

    if (rel === 'canonical' && href) data.canonical = href;
    if ((rel === 'icon' || rel === 'shortcut icon' || rel === 'apple-touch-icon') && href) {
      data.favicon = true;
    }

    data.links.push({ href, rel, hreflang });
  }

  // Headings
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let headingMatch;
  while ((headingMatch = headingRegex.exec(bodyHtml)) !== null) {
    const level = parseInt(headingMatch[1].charAt(1));
    const text = stripTags(headingMatch[2]);
    data.headings.push({ level, text });
    if (level === 1) {
      data.h1s.push(text);
    }
  }

  // Images
  const imgRegex = /<img\s[^>]*?\/?>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    data.images.push({
      src: getAttr(tag, 'src') || '',
      alt: getAttr(tag, 'alt'),
      loading: getAttr(tag, 'loading'),
    });
  }

  // Scripts
  const scriptRegex = /<script\s([^>]*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  const inHeadSection = headHtml;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const attrs = scriptMatch[1];
    const content = scriptMatch[2];
    const type = getAttr('<script ' + attrs + '>', 'type');

    if (type === 'application/ld+json' && content.trim()) {
      data.jsonLd.push(content.trim());
    } else {
      const src = getAttr('<script ' + attrs + '>', 'src');
      const isInHead = inHeadSection.includes(scriptMatch[0]);
      data.scripts.push({
        src,
        async: hasAttr(attrs, 'async'),
        defer: hasAttr(attrs, 'defer'),
        isModule: type === 'module',
        inHead: isInHead,
      });
    }
  }

  // Anchors
  const anchorRegex = /<a\s[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(bodyHtml)) !== null) {
    const href = decodeHtmlEntities(anchorMatch[1] ?? anchorMatch[2] ?? anchorMatch[3] ?? '');
    let isInternal = false;
    try {
      if (href.startsWith('/') || href.startsWith('#') || href.startsWith('./') || href.startsWith('../')) {
        isInternal = true;
      } else {
        const linkUrl = new URL(href, finalUrl);
        const pageUrl = new URL(finalUrl);
        isInternal = linkUrl.hostname === pageUrl.hostname;
      }
    } catch {
      // malformed URL
    }
    data.anchors.push({ href, isInternal });
  }

  // Body text length (strip all tags from body, count remaining text)
  const bodyText = stripTags(
    bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
  );
  data.bodyTextLength = bodyText.length;

  return data;
}
