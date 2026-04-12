import type { CheckResult, ParsedSEOData } from '../scanner/types';

export function checkStructuredData(data: ParsedSEOData): CheckResult[] {
  const checks: CheckResult[] = [];

  // JSON-LD presence
  checks.push({
    id: 'schema-jsonld-present',
    name: 'Structured data (JSON-LD)',
    status: data.jsonLd.length > 0 ? 'pass' : 'fail',
    weight: 3,
    message:
      data.jsonLd.length > 0
        ? `Found ${data.jsonLd.length} JSON-LD block(s).`
        : 'No structured data (JSON-LD) found. Structured data helps search engines understand your content and can enable rich results (stars, FAQs, breadcrumbs, etc.).',
    fixSnippet:
      data.jsonLd.length > 0
        ? undefined
        : `<script type="application/ld+json">\n${JSON.stringify(
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: data.title || 'Your Page Title',
              description: data.metaDescription || 'Your page description',
              url: data.finalUrl,
            },
            null,
            2
          )}\n</script>`,
  });

  // Validate each JSON-LD block
  const parsedBlocks: Array<Record<string, unknown>> = [];
  for (let i = 0; i < data.jsonLd.length; i++) {
    const raw = data.jsonLd[i];
    try {
      const parsed = JSON.parse(raw);
      parsedBlocks.push(parsed);
    } catch {
      checks.push({
        id: `schema-jsonld-valid-${i}`,
        name: `JSON-LD block ${i + 1} valid JSON`,
        status: 'fail',
        weight: 2,
        message: `JSON-LD block ${i + 1} contains invalid JSON. Search engines will ignore it.`,
        fixSnippet: '<!-- Validate your JSON-LD at https://validator.schema.org/ -->',
      });
    }
  }

  // Check @type and @context
  if (parsedBlocks.length > 0) {
    const typesFound: string[] = [];
    let hasContext = false;

    for (const block of parsedBlocks) {
      if (block['@context'] === 'https://schema.org' || block['@context'] === 'http://schema.org') {
        hasContext = true;
      }
      const blockType = block['@type'] as string | undefined;
      if (blockType) {
        typesFound.push(blockType);
      }

      // Check @graph pattern
      if (Array.isArray(block['@graph'])) {
        for (const item of block['@graph'] as Array<Record<string, unknown>>) {
          if (item['@type']) {
            typesFound.push(item['@type'] as string);
          }
        }
      }
    }

    checks.push({
      id: 'schema-context',
      name: 'Schema.org context',
      status: hasContext ? 'pass' : 'fail',
      weight: 1,
      message: hasContext
        ? 'JSON-LD uses proper schema.org context.'
        : 'JSON-LD is missing @context: "https://schema.org". Without this, search engines cannot interpret the structured data.',
    });

    if (typesFound.length > 0) {
      checks.push({
        id: 'schema-types',
        name: 'Schema types',
        status: 'pass',
        weight: 2,
        message: `Schema types found: ${typesFound.join(', ')}`,
      });
    } else {
      checks.push({
        id: 'schema-types',
        name: 'Schema types',
        status: 'fail',
        weight: 2,
        message: 'JSON-LD is missing @type. Without a type, search engines cannot use the structured data for rich results.',
      });
    }

    // BreadcrumbList suggestion
    const hasBreadcrumb = typesFound.some((t) => t === 'BreadcrumbList');
    if (!hasBreadcrumb) {
      checks.push({
        id: 'schema-breadcrumbs',
        name: 'Breadcrumb schema',
        status: 'warn',
        weight: 1,
        message:
          'No BreadcrumbList schema found. Adding breadcrumb structured data can show breadcrumb navigation in search results, improving click-through rates.',
        fixSnippet: `<script type="application/ld+json">\n${JSON.stringify(
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: data.finalUrl.split('/').slice(0, 3).join('/'),
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: data.title || 'Current Page',
                item: data.finalUrl,
              },
            ],
          },
          null,
          2
        )}\n</script>`,
      });
    }

    // Schema type suggestions based on page signals
    const suggestedType = detectPageType(data, typesFound);
    if (suggestedType) {
      checks.push({
        id: 'schema-type-suggestion',
        name: 'Schema type suggestion',
        status: 'warn',
        weight: 1,
        message: suggestedType.message,
        fixSnippet: suggestedType.snippet,
      });
    }
  }

  return checks;
}

function detectPageType(
  data: ParsedSEOData,
  existingTypes: string[]
): { message: string; snippet: string } | null {
  const text = (data.title || '').toLowerCase() + ' ' + (data.metaDescription || '').toLowerCase();
  const bodyText = data.bodyTextLength;

  // Check for article signals
  const hasArticleSignals =
    bodyText > 1000 &&
    data.headings.length >= 3 &&
    !existingTypes.some((t) => t === 'Article' || t === 'BlogPosting' || t === 'NewsArticle');
  if (hasArticleSignals) {
    return {
      message:
        'This page looks like an article or blog post (long content, multiple headings). Consider adding Article or BlogPosting schema for rich results.',
      snippet: `<script type="application/ld+json">\n${JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: data.title || 'Article Title',
          description: data.metaDescription || '',
          url: data.finalUrl,
        },
        null,
        2
      )}\n</script>`,
    };
  }

  // Check for FAQ signals
  const headingTexts = data.headings.map((h) => h.text.toLowerCase());
  const questionCount = headingTexts.filter(
    (t) => t.includes('?') || t.startsWith('how') || t.startsWith('what') || t.startsWith('why') || t.startsWith('when')
  ).length;
  const hasFaqSignals =
    questionCount >= 3 &&
    !existingTypes.some((t) => t === 'FAQPage');
  if (hasFaqSignals) {
    return {
      message:
        'This page contains multiple question-like headings. Consider adding FAQPage schema to get FAQ rich results in Google search.',
      snippet:
        '<!-- Add FAQPage schema with your questions and answers -->\n<!-- See: https://developers.google.com/search/docs/appearance/structured-data/faqpage -->',
    };
  }

  // Check for product signals
  const hasProductSignals =
    (text.includes('price') || text.includes('buy') || text.includes('add to cart') || text.includes('shop')) &&
    !existingTypes.some((t) => t === 'Product');
  if (hasProductSignals) {
    return {
      message:
        'This page may be a product page. Consider adding Product schema for rich results showing price, availability, and reviews.',
      snippet:
        '<!-- Add Product schema with price, availability, and review data -->\n<!-- See: https://developers.google.com/search/docs/appearance/structured-data/product -->',
    };
  }

  return null;
}
