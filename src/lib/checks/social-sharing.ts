import type { CheckResult, ParsedSEOData } from '../scanner/types';

export function checkSocialSharing(data: ParsedSEOData): CheckResult[] {
  const checks: CheckResult[] = [];
  const og = data.ogTags;
  const tw = data.twitterTags;

  // og:title
  checks.push({
    id: 'social-og-title',
    name: 'Open Graph title',
    status: og['og:title'] ? 'pass' : 'fail',
    weight: 3,
    message: og['og:title']
      ? 'og:title is set.'
      : 'Missing og:title. When your link is shared on social media, it will show a generic or blank title.',
    fixSnippet: og['og:title']
      ? undefined
      : `<meta property="og:title" content="${data.title || 'Your Page Title'}" />`,
  });

  // og:description
  checks.push({
    id: 'social-og-description',
    name: 'Open Graph description',
    status: og['og:description'] ? 'pass' : 'fail',
    weight: 2,
    message: og['og:description']
      ? 'og:description is set.'
      : 'Missing og:description. Social media shares will lack a preview description.',
    fixSnippet: og['og:description']
      ? undefined
      : `<meta property="og:description" content="${data.metaDescription || 'A brief description of your page.'}" />`,
  });

  // og:image
  checks.push({
    id: 'social-og-image',
    name: 'Open Graph image',
    status: og['og:image'] ? 'pass' : 'fail',
    weight: 3,
    message: og['og:image']
      ? 'og:image is set.'
      : 'Missing og:image. Shared links without an image get significantly less engagement.',
    details: og['og:image'] ? `Image URL: ${og['og:image']}` : undefined,
    fixSnippet: og['og:image']
      ? undefined
      : '<meta property="og:image" content="https://yoursite.com/og-image.png" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />',
  });

  // og:image dimensions hint
  if (og['og:image']) {
    const hasWidth = !!og['og:image:width'];
    const hasHeight = !!og['og:image:height'];
    if (!hasWidth || !hasHeight) {
      checks.push({
        id: 'social-og-image-dimensions',
        name: 'OG image dimensions',
        status: 'warn',
        weight: 1,
        message: 'og:image is missing width/height tags. Adding them helps platforms render the preview faster. Recommended size is 1200x630.',
        fixSnippet: '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />',
      });
    }
  }

  // og:url
  checks.push({
    id: 'social-og-url',
    name: 'Open Graph URL',
    status: og['og:url'] ? 'pass' : 'warn',
    weight: 2,
    message: og['og:url']
      ? 'og:url is set.'
      : 'Missing og:url. Set this to the canonical URL of the page.',
    fixSnippet: og['og:url']
      ? undefined
      : `<meta property="og:url" content="${data.finalUrl}" />`,
  });

  // og:type
  checks.push({
    id: 'social-og-type',
    name: 'Open Graph type',
    status: og['og:type'] ? 'pass' : 'warn',
    weight: 1,
    message: og['og:type']
      ? `og:type is set to "${og['og:type']}".`
      : 'Missing og:type. Defaults to "website" but setting it explicitly is better.',
    fixSnippet: og['og:type']
      ? undefined
      : '<meta property="og:type" content="website" />',
  });

  // twitter:card
  checks.push({
    id: 'social-twitter-card',
    name: 'Twitter Card type',
    status: tw['twitter:card'] ? 'pass' : 'fail',
    weight: 2,
    message: tw['twitter:card']
      ? `Twitter Card is set to "${tw['twitter:card']}".`
      : 'Missing twitter:card. Without this, shared links on X/Twitter will not show a rich preview.',
    fixSnippet: tw['twitter:card']
      ? undefined
      : '<meta name="twitter:card" content="summary_large_image" />',
  });

  // twitter:title
  if (!tw['twitter:title'] && !og['og:title']) {
    checks.push({
      id: 'social-twitter-title',
      name: 'Twitter title',
      status: 'warn',
      weight: 1,
      message: 'No twitter:title or og:title set. X/Twitter needs one of these for rich previews.',
      fixSnippet: `<meta name="twitter:title" content="${data.title || 'Your Page Title'}" />`,
    });
  }

  // twitter:image
  if (!tw['twitter:image'] && !og['og:image']) {
    checks.push({
      id: 'social-twitter-image',
      name: 'Twitter image',
      status: 'warn',
      weight: 1,
      message: 'No twitter:image or og:image set. X/Twitter shares will not show an image preview.',
      fixSnippet: '<meta name="twitter:image" content="https://yoursite.com/og-image.png" />',
    });
  }

  return checks;
}
