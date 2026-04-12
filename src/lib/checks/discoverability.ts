import type { CheckResult, ParsedSEOData, ExternalCheckData } from '../scanner/types';

export function checkDiscoverability(data: ParsedSEOData, external: ExternalCheckData): CheckResult[] {
  const checks: CheckResult[] = [];

  // HTTPS
  checks.push({
    id: 'discover-https',
    name: 'HTTPS',
    status: external.isHttps ? 'pass' : 'fail',
    weight: 3,
    message: external.isHttps
      ? 'Site is served over HTTPS.'
      : 'Site is not using HTTPS. Google considers HTTPS a ranking signal, and browsers mark HTTP sites as "Not Secure".',
  });

  // robots.txt accessible
  checks.push({
    id: 'discover-robots-txt',
    name: 'robots.txt',
    status: external.robotsTxt.accessible ? 'pass' : 'fail',
    weight: 3,
    message: external.robotsTxt.accessible
      ? 'robots.txt is accessible.'
      : 'robots.txt is missing or inaccessible. This file tells search engines what they can and cannot crawl.',
    fixSnippet: external.robotsTxt.accessible
      ? undefined
      : 'User-agent: *\nAllow: /\n\nSitemap: https://yoursite.com/sitemap.xml',
  });

  // robots.txt allows crawling
  if (external.robotsTxt.accessible) {
    checks.push({
      id: 'discover-robots-allows',
      name: 'Crawling allowed',
      status: external.robotsTxt.allowsCrawling ? 'pass' : 'fail',
      weight: 2,
      message: external.robotsTxt.allowsCrawling
        ? 'robots.txt allows search engine crawling.'
        : 'robots.txt appears to block search engine crawling. Make sure important paths are not disallowed.',
    });

    // robots.txt references sitemap
    checks.push({
      id: 'discover-robots-sitemap',
      name: 'Sitemap in robots.txt',
      status: external.robotsTxt.referencesSitemap ? 'pass' : 'warn',
      weight: 2,
      message: external.robotsTxt.referencesSitemap
        ? 'robots.txt references a sitemap.'
        : 'robots.txt does not reference a sitemap. Adding a Sitemap directive helps search engines find your sitemap faster.',
      fixSnippet: external.robotsTxt.referencesSitemap
        ? undefined
        : '# Add this line to your robots.txt:\nSitemap: https://yoursite.com/sitemap.xml',
    });
  }

  // Sitemap accessible
  checks.push({
    id: 'discover-sitemap',
    name: 'XML Sitemap',
    status: external.sitemap.accessible ? 'pass' : 'fail',
    weight: 3,
    message: external.sitemap.accessible
      ? 'sitemap.xml is accessible.'
      : 'No sitemap found at /sitemap.xml or /sitemap-index.xml. A sitemap helps search engines discover all your pages.',
    fixSnippet: external.sitemap.accessible
      ? undefined
      : '<!-- Most frameworks have sitemap plugins: -->\n<!-- Astro: @astrojs/sitemap -->\n<!-- Next.js: app/sitemap.ts -->\n<!-- Or create a static sitemap.xml in your public folder -->',
  });

  // Noindex check
  checks.push({
    id: 'discover-noindex',
    name: 'Indexability',
    status: data.noindex ? 'fail' : 'pass',
    weight: 3,
    message: data.noindex
      ? 'This page has a noindex directive. Search engines will NOT index this page. If this is unintentional, remove the noindex tag.'
      : 'Page is indexable (no noindex directive found).',
    details: data.noindex
      ? data.xRobotsTag
        ? `Found via X-Robots-Tag header: "${data.xRobotsTag}"`
        : 'Found via <meta name="robots" content="noindex"> tag'
      : undefined,
    fixSnippet: data.noindex
      ? '<!-- Remove this if you want the page indexed: -->\n<!-- <meta name="robots" content="noindex"> -->\n<!-- Also check your server headers for X-Robots-Tag -->'
      : undefined,
  });

  // llms.txt
  checks.push({
    id: 'discover-llms-txt',
    name: 'llms.txt (AI visibility)',
    status: external.llmsTxt.accessible ? 'pass' : 'warn',
    weight: 1,
    message: external.llmsTxt.accessible
      ? 'llms.txt is present. This helps AI search tools understand your site.'
      : 'No llms.txt found. This is a new standard that helps AI-powered search tools (like ChatGPT, Perplexity, Claude) understand your site.',
    fixSnippet: external.llmsTxt.accessible
      ? undefined
      : '# Create a llms.txt file in your public folder with:\n# - A brief description of your site\n# - Key pages and their purposes\n# - Contact info\n# See https://llmstxt.org for the spec',
  });

  // CSR detection
  const bodyLength = data.bodyTextLength;
  const hasThinBody = bodyLength < 200;
  const hasRootDiv =
    data.headings.length === 0 && data.h1s.length === 0 && hasThinBody;
  if (hasRootDiv) {
    checks.push({
      id: 'discover-csr-warning',
      name: 'Client-side rendering detected',
      status: 'warn',
      weight: 2,
      message:
        'This page appears to rely heavily on client-side JavaScript rendering. The initial HTML has very little content. Search engines may not fully index JavaScript-rendered content.',
      details: `Body text length: ${bodyLength} characters, 0 headings found in server-rendered HTML.`,
      fixSnippet:
        '<!-- Consider server-side rendering (SSR) or static site generation (SSG) -->\n<!-- for your critical pages to ensure search engines can index your content. -->\n<!-- Most frameworks support this: Next.js (SSR/SSG), Astro (SSG), Remix (SSR) -->',
    });
  }

  // Hreflang tags
  const hreflangLinks = data.links.filter((l) => l.hreflang);
  if (hreflangLinks.length > 0) {
    checks.push({
      id: 'discover-hreflang',
      name: 'Hreflang tags',
      status: 'pass',
      weight: 1,
      message: `Found ${hreflangLinks.length} hreflang tag(s) for multi-language support.`,
    });
  }

  return checks;
}
