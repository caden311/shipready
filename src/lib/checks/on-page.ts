import type { CheckResult, ParsedSEOData } from '../scanner/types';

export function checkOnPage(data: ParsedSEOData): CheckResult[] {
  const checks: CheckResult[] = [];

  // H1 check
  const h1Count = data.h1s.length;
  checks.push({
    id: 'onpage-h1',
    name: 'H1 heading',
    status: h1Count === 1 ? 'pass' : h1Count === 0 ? 'fail' : 'warn',
    weight: 3,
    message:
      h1Count === 0
        ? 'No H1 heading found. Every page should have exactly one H1 that describes the page content.'
        : h1Count === 1
          ? `H1 found: "${data.h1s[0]}"`
          : `Found ${h1Count} H1 headings. A page should have exactly one H1 to clearly communicate the main topic.`,
    details: h1Count > 1 ? data.h1s.map((h, i) => `H1 #${i + 1}: "${h}"`).join('\n') : undefined,
    fixSnippet:
      h1Count === 0
        ? '<h1>Your Main Page Heading</h1>'
        : h1Count > 1
          ? '<!-- Keep only one <h1> tag per page. Change the others to <h2> or lower. -->'
          : undefined,
  });

  // Heading hierarchy
  if (data.headings.length > 1) {
    const skippedLevels: string[] = [];
    for (let i = 1; i < data.headings.length; i++) {
      const prev = data.headings[i - 1].level;
      const curr = data.headings[i].level;
      if (curr > prev + 1) {
        skippedLevels.push(`h${prev} -> h${curr} (skipped h${prev + 1})`);
      }
    }

    checks.push({
      id: 'onpage-heading-hierarchy',
      name: 'Heading hierarchy',
      status: skippedLevels.length === 0 ? 'pass' : 'warn',
      weight: 2,
      message:
        skippedLevels.length === 0
          ? 'Heading hierarchy is properly structured.'
          : `Heading levels are skipped. This makes it harder for screen readers and search engines to understand your content structure.`,
      details: skippedLevels.length > 0 ? skippedLevels.join('\n') : undefined,
      fixSnippet:
        skippedLevels.length > 0
          ? '<!-- Use headings in order: h1 -> h2 -> h3 -> h4 -->\n<!-- Don\'t skip from h1 directly to h3 -->'
          : undefined,
    });
  }

  // Image alt text
  const totalImages = data.images.length;
  if (totalImages > 0) {
    const missingAlt = data.images.filter((img) => img.alt === null || img.alt === '').length;
    const coverage = Math.round(((totalImages - missingAlt) / totalImages) * 100);

    checks.push({
      id: 'onpage-image-alt',
      name: 'Image alt text',
      status: missingAlt === 0 ? 'pass' : coverage >= 80 ? 'warn' : 'fail',
      weight: 3,
      message:
        missingAlt === 0
          ? `All ${totalImages} images have alt text.`
          : `${missingAlt} of ${totalImages} images are missing alt text (${coverage}% coverage). Alt text is essential for accessibility and helps search engines understand your images.`,
      fixSnippet:
        missingAlt > 0
          ? '<!-- Add descriptive alt text to every <img> tag: -->\n<img src="photo.jpg" alt="A brief description of what the image shows" />'
          : undefined,
    });

    // Lazy loading
    const missingLazy = data.images.filter((img) => img.loading !== 'lazy').length;
    if (missingLazy > 2) {
      checks.push({
        id: 'onpage-image-lazy',
        name: 'Image lazy loading',
        status: 'warn',
        weight: 1,
        message: `${missingLazy} of ${totalImages} images don't use lazy loading. Adding loading="lazy" to below-the-fold images improves page load speed.`,
        fixSnippet:
          '<!-- Add loading="lazy" to images below the fold: -->\n<img src="photo.jpg" alt="description" loading="lazy" />\n<!-- Note: Don\'t lazy-load your hero/above-the-fold image -->',
      });
    }
  }

  // Internal links
  const internalLinks = data.anchors.filter((a) => a.isInternal);
  checks.push({
    id: 'onpage-internal-links',
    name: 'Internal links',
    status: internalLinks.length > 0 ? 'pass' : 'warn',
    weight: 1,
    message:
      internalLinks.length > 0
        ? `Found ${internalLinks.length} internal link(s).`
        : 'No internal links found. Pages without internal links are harder for search engines to discover and may be treated as orphan pages.',
    fixSnippet:
      internalLinks.length === 0
        ? '<!-- Add links to your other pages: -->\n<a href="/about">About Us</a>\n<a href="/blog">Read Our Blog</a>'
        : undefined,
  });

  // Word count
  const wordCount = data.bodyTextLength > 0 ? data.bodyTextLength / 5 : 0; // rough estimate
  if (wordCount < 300 && data.bodyTextLength > 0) {
    checks.push({
      id: 'onpage-word-count',
      name: 'Content length',
      status: wordCount < 100 ? 'fail' : 'warn',
      weight: 1,
      message: `Page has approximately ${Math.round(wordCount)} words. Pages with very little content (under 300 words) may be considered "thin content" by search engines.`,
    });
  } else if (data.bodyTextLength > 0) {
    checks.push({
      id: 'onpage-word-count',
      name: 'Content length',
      status: 'pass',
      weight: 1,
      message: `Page has approximately ${Math.round(wordCount)} words.`,
    });
  }

  return checks;
}
