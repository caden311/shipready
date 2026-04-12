import type { CheckResult, ParsedSEOData } from '../scanner/types';

export function checkPerformance(data: ParsedSEOData): CheckResult[] {
  const checks: CheckResult[] = [];

  // Render-blocking scripts in head
  const blockingScripts = data.scripts.filter(
    (s) => s.inHead && s.src && !s.async && !s.defer
  );
  checks.push({
    id: 'perf-render-blocking',
    name: 'Render-blocking scripts',
    status: blockingScripts.length === 0 ? 'pass' : 'warn',
    weight: 2,
    message:
      blockingScripts.length === 0
        ? 'No render-blocking scripts found in <head>.'
        : `Found ${blockingScripts.length} render-blocking script(s) in <head>. These delay page rendering and hurt Core Web Vitals.`,
    details:
      blockingScripts.length > 0
        ? blockingScripts.map((s) => s.src).join('\n')
        : undefined,
    fixSnippet:
      blockingScripts.length > 0
        ? '<!-- Add async or defer to scripts in <head>: -->\n<script src="your-script.js" defer></script>\n<!-- Use "defer" for scripts that need DOM access -->\n<!-- Use "async" for independent scripts like analytics -->'
        : undefined,
  });

  // Image format modernity
  const imageExts = data.images
    .map((img) => {
      try {
        const pathname = new URL(img.src, data.finalUrl).pathname;
        return pathname.split('.').pop()?.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const legacyFormats = imageExts.filter(
    (ext) => ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'bmp'
  );
  const modernFormats = imageExts.filter(
    (ext) => ext === 'webp' || ext === 'avif' || ext === 'svg'
  );

  if (imageExts.length > 0) {
    const allModern = legacyFormats.length === 0;
    checks.push({
      id: 'perf-image-formats',
      name: 'Modern image formats',
      status: allModern ? 'pass' : legacyFormats.length <= 2 ? 'warn' : 'warn',
      weight: 1,
      message: allModern
        ? 'All images use modern formats (WebP, AVIF, or SVG).'
        : `${legacyFormats.length} of ${imageExts.length} images use legacy formats (JPG, PNG, GIF). Modern formats like WebP and AVIF are significantly smaller.`,
      fixSnippet: allModern
        ? undefined
        : '<!-- Convert images to WebP or AVIF for better compression: -->\n<picture>\n  <source srcset="image.avif" type="image/avif" />\n  <source srcset="image.webp" type="image/webp" />\n  <img src="image.jpg" alt="description" />\n</picture>',
    });
  }

  // Text compression
  const contentEncoding = data.responseHeaders['content-encoding'];
  const hasCompression = contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('br'));
  checks.push({
    id: 'perf-compression',
    name: 'Text compression',
    status: hasCompression ? 'pass' : 'warn',
    weight: 1,
    message: hasCompression
      ? `Text compression is enabled (${contentEncoding}).`
      : 'No text compression detected (gzip/brotli). Enabling compression reduces transfer size significantly.',
    fixSnippet: hasCompression
      ? undefined
      : '<!-- Enable gzip or brotli compression on your server/CDN. -->\n<!-- Most hosting providers (Vercel, Netlify, Cloudflare) enable this by default. -->\n<!-- Check your hosting provider\'s documentation. -->',
  });

  // Excessive DOM size (rough estimate from headings + images + scripts)
  const elementEstimate = data.headings.length + data.images.length + data.scripts.length + data.anchors.length;
  if (elementEstimate > 500) {
    checks.push({
      id: 'perf-dom-size',
      name: 'DOM complexity',
      status: 'warn',
      weight: 1,
      message: `Page appears to have a very large DOM (estimated ${elementEstimate}+ key elements). Large DOMs can slow down rendering and interactivity.`,
    });
  }

  return checks;
}
