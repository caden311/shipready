import type { CheckResult, ParsedSEOData } from '../scanner/types';

export function checkMetaHead(data: ParsedSEOData): CheckResult[] {
  const checks: CheckResult[] = [];

  // Title exists
  checks.push({
    id: 'meta-title-exists',
    name: 'Page title',
    status: data.title ? 'pass' : 'fail',
    weight: 3,
    message: data.title ? 'Page has a title tag.' : 'Missing title tag. This is critical for search rankings.',
    details: data.title ? `Title: "${data.title}"` : undefined,
    fixSnippet: data.title ? undefined : '<title>Your Page Title - Your Site Name</title>',
  });

  // Title length
  if (data.title) {
    const len = data.title.length;
    const tooShort = len < 30;
    const tooLong = len > 60;
    checks.push({
      id: 'meta-title-length',
      name: 'Title length',
      status: tooShort || tooLong ? 'warn' : 'pass',
      weight: 2,
      message:
        tooShort
          ? `Title is ${len} characters. Aim for 30-60 characters to avoid truncation in search results.`
          : tooLong
            ? `Title is ${len} characters. Google typically displays 50-60 characters. Consider shortening it.`
            : `Title length is ${len} characters, within the recommended 30-60 range.`,
      details: `"${data.title}" (${len} chars)`,
    });
  }

  // Meta description exists
  checks.push({
    id: 'meta-description-exists',
    name: 'Meta description',
    status: data.metaDescription ? 'pass' : 'fail',
    weight: 3,
    message: data.metaDescription
      ? 'Page has a meta description.'
      : 'Missing meta description. Search engines use this as the snippet below your page title.',
    fixSnippet: data.metaDescription
      ? undefined
      : '<meta name="description" content="A concise, compelling description of your page in 120-160 characters." />',
  });

  // Meta description length
  if (data.metaDescription) {
    const len = data.metaDescription.length;
    const tooShort = len < 120;
    const tooLong = len > 160;
    checks.push({
      id: 'meta-description-length',
      name: 'Description length',
      status: tooShort || tooLong ? 'warn' : 'pass',
      weight: 2,
      message:
        tooShort
          ? `Meta description is ${len} characters. Aim for 120-160 characters to maximize search snippet space.`
          : tooLong
            ? `Meta description is ${len} characters. Google truncates descriptions over ~160 characters.`
            : `Meta description is ${len} characters, within the recommended 120-160 range.`,
    });
  }

  // Title !== description
  if (data.title && data.metaDescription) {
    const titleLower = data.title.toLowerCase().trim();
    const descLower = data.metaDescription.toLowerCase().trim();
    const isDuplicate = titleLower === descLower;
    checks.push({
      id: 'meta-title-desc-unique',
      name: 'Title and description are unique',
      status: isDuplicate ? 'fail' : 'pass',
      weight: 2,
      message: isDuplicate
        ? 'Title and meta description are identical. These should be different to maximize search visibility.'
        : 'Title and description are distinct.',
      fixSnippet: isDuplicate
        ? '<!-- Make your title a concise headline and your description a compelling summary -->\n<title>Your Page Title</title>\n<meta name="description" content="A different, longer description that expands on the title." />'
        : undefined,
    });
  }

  // Charset
  checks.push({
    id: 'meta-charset',
    name: 'Character encoding',
    status: data.charset ? 'pass' : 'warn',
    weight: 1,
    message: data.charset
      ? 'Character encoding is declared.'
      : 'No charset declaration found. Add one to ensure text renders correctly.',
    fixSnippet: data.charset ? undefined : '<meta charset="utf-8" />',
  });

  // Viewport
  checks.push({
    id: 'meta-viewport',
    name: 'Viewport meta tag',
    status: data.viewport ? 'pass' : 'fail',
    weight: 2,
    message: data.viewport
      ? 'Viewport meta tag is set.'
      : 'Missing viewport meta tag. Your page may not render correctly on mobile devices, which hurts mobile search rankings.',
    fixSnippet: data.viewport
      ? undefined
      : '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  });

  // HTML lang
  checks.push({
    id: 'meta-html-lang',
    name: 'HTML lang attribute',
    status: data.htmlLang ? 'pass' : 'fail',
    weight: 2,
    message: data.htmlLang
      ? `Language is set to "${data.htmlLang}".`
      : 'Missing lang attribute on <html>. This helps search engines understand your content language.',
    fixSnippet: data.htmlLang ? undefined : '<html lang="en">',
  });

  // Canonical URL
  const hasCanonical = !!data.canonical;
  checks.push({
    id: 'meta-canonical',
    name: 'Canonical URL',
    status: hasCanonical ? 'pass' : 'fail',
    weight: 3,
    message: hasCanonical
      ? 'Canonical URL is set.'
      : 'Missing canonical URL. This tells search engines which version of the page to index, preventing duplicate content issues.',
    details: hasCanonical ? `Canonical: ${data.canonical}` : undefined,
    fixSnippet: hasCanonical
      ? undefined
      : `<link rel="canonical" href="${data.finalUrl}" />`,
  });

  // Canonical mismatch
  if (data.canonical) {
    let canonicalNormalized = data.canonical;
    let finalNormalized = data.finalUrl;
    try {
      canonicalNormalized = new URL(data.canonical, data.finalUrl).toString().replace(/\/$/, '');
      finalNormalized = data.finalUrl.replace(/\/$/, '');
    } catch {
      // keep as-is
    }
    const matches = canonicalNormalized === finalNormalized;
    if (!matches) {
      checks.push({
        id: 'meta-canonical-match',
        name: 'Canonical matches page URL',
        status: 'warn',
        weight: 2,
        message: `Canonical URL differs from the actual page URL. This might be intentional (e.g., preferred version) but could also cause indexing issues.`,
        details: `Canonical: ${data.canonical}\nPage URL: ${data.finalUrl}`,
      });
    }
  }

  // Favicon
  checks.push({
    id: 'meta-favicon',
    name: 'Favicon',
    status: data.favicon ? 'pass' : 'warn',
    weight: 1,
    message: data.favicon
      ? 'Favicon is present.'
      : 'No favicon found. A favicon improves brand recognition in browser tabs and bookmarks.',
    fixSnippet: data.favicon
      ? undefined
      : '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
  });

  // URL structure
  try {
    const url = new URL(data.finalUrl);
    const hasExcessiveParams = url.searchParams.toString().length > 100;
    if (hasExcessiveParams) {
      checks.push({
        id: 'meta-url-structure',
        name: 'URL structure',
        status: 'warn',
        weight: 1,
        message: 'URL has many query parameters. Clean, descriptive URLs are better for SEO and user experience.',
        details: `URL: ${data.finalUrl}`,
      });
    }
  } catch {
    // skip URL structure check if URL is unparseable
  }

  return checks;
}
