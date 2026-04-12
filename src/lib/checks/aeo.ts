import type { CheckResult, ParsedSEOData, ExternalCheckData } from '../scanner/types';

const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Bytespider',
  'Google-Extended',
  'Applebot-Extended',
];

const GENERIC_H1S = ['home', 'welcome', 'homepage', 'home page', 'untitled'];

const FILLER_PREFIXES = ['welcome to', 'home page', 'this is the'];

const QUESTION_WORDS = ['what', 'how', 'why', 'when', 'where', 'can', 'does', 'is'];

const AEO_SCHEMA_TYPES = ['FAQPage', 'HowTo', 'QAPage'];

function getBlockedAICrawlers(robotsContent: string): string[] {
  const blocked: string[] = [];
  const lines = robotsContent.split('\n').map((l) => l.trim());

  let currentAgents: string[] = [];
  for (const line of lines) {
    const agentMatch = line.match(/^User-agent:\s*(.+)/i);
    if (agentMatch) {
      const agent = agentMatch[1].trim();
      if (currentAgents.length === 0 || lines[lines.indexOf(line) - 1]?.match(/^User-agent:/i)) {
        currentAgents.push(agent);
      } else {
        currentAgents = [agent];
      }
      continue;
    }

    const disallowMatch = line.match(/^Disallow:\s*\/\s*$/i);
    if (disallowMatch && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        const matchedCrawler = AI_CRAWLERS.find(
          (c) => c.toLowerCase() === agent.toLowerCase() || agent === '*'
        );
        if (matchedCrawler && agent !== '*') {
          blocked.push(matchedCrawler);
        }
      }
    }

    if (line === '' || line.startsWith('#')) {
      if (line === '') currentAgents = [];
    }
  }

  return [...new Set(blocked)];
}

function parseJsonLdTypes(jsonLdBlocks: string[]): string[] {
  const types: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const items = parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (item['@type']) {
          const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
          types.push(...t);
        }
      }
    } catch {
      // skip invalid JSON-LD
    }
  }
  return types;
}

function hasJsonLdProperty(jsonLdBlocks: string[], property: string): boolean {
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const items = parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (property in item) return true;
      }
    } catch {
      // skip invalid
    }
  }
  return false;
}

export function checkAEO(data: ParsedSEOData, external: ExternalCheckData): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. AI Crawler Access
  if (!external.robotsTxt.accessible) {
    checks.push({
      id: 'aeo-ai-crawlers',
      name: 'AI crawler access',
      status: 'warn',
      weight: 3,
      message:
        'Could not access robots.txt to verify AI crawler permissions. Ensure your robots.txt is accessible.',
    });
  } else if (external.robotsTxt.content) {
    const blocked = getBlockedAICrawlers(external.robotsTxt.content);
    checks.push({
      id: 'aeo-ai-crawlers',
      name: 'AI crawler access',
      status: blocked.length > 0 ? 'fail' : 'pass',
      weight: 3,
      message:
        blocked.length > 0
          ? `Your robots.txt blocks these AI crawlers: ${blocked.join(', ')}. This prevents your content from appearing in AI-powered search results.`
          : 'No AI crawlers are blocked in robots.txt. Your content is accessible to AI search engines.',
      details:
        blocked.length > 0
          ? `Blocked agents: ${blocked.join(', ')}. Consider allowing these to appear in ChatGPT, Perplexity, Claude, and Google AI Overviews.`
          : undefined,
      fixSnippet:
        blocked.length > 0
          ? `# Remove or comment out the Disallow rules for AI crawlers:\n${blocked.map((b) => `# User-agent: ${b}\n# Disallow: /`).join('\n')}`
          : undefined,
    });
  } else {
    checks.push({
      id: 'aeo-ai-crawlers',
      name: 'AI crawler access',
      status: 'pass',
      weight: 3,
      message: 'robots.txt is accessible with no content, so AI crawlers are not blocked.',
    });
  }

  // 2. llms.txt
  checks.push({
    id: 'aeo-llms-txt',
    name: 'llms.txt (AI visibility)',
    status: external.llmsTxt.accessible ? 'pass' : 'warn',
    weight: 2,
    message: external.llmsTxt.accessible
      ? 'llms.txt is present. This helps AI search tools understand your site.'
      : 'No llms.txt found. This standard helps AI-powered search tools (like ChatGPT, Perplexity, Claude) understand your site.',
    fixSnippet: external.llmsTxt.accessible
      ? undefined
      : '# Create a llms.txt file in your public folder with:\n# - A brief description of your site\n# - Key pages and their purposes\n# - Contact info\n# See https://llmstxt.org for the spec',
  });

  // 3. Concise Meta Description
  if (!data.metaDescription) {
    checks.push({
      id: 'aeo-meta-description',
      name: 'Concise meta description for AI',
      status: 'fail',
      weight: 2,
      message:
        'No meta description found. Answer engines use this as a primary source for generating responses about your page.',
      fixSnippet:
        '<meta name="description" content="A concise, direct answer describing what this page offers and who it helps.">',
    });
  } else {
    const desc = data.metaDescription.toLowerCase();
    const hasFiller = FILLER_PREFIXES.some((p) => desc.startsWith(p));
    const tooLong = data.metaDescription.length > 160;

    let status: 'pass' | 'warn' = 'pass';
    let message = 'Meta description is concise and suitable for AI extraction.';

    if (hasFiller) {
      status = 'warn';
      message =
        'Meta description starts with generic filler. Lead with a direct answer about what your page does or offers.';
    } else if (tooLong) {
      status = 'warn';
      message = `Meta description is ${data.metaDescription.length} characters. Answer engines prefer concise, direct answers under 160 characters.`;
    }

    checks.push({
      id: 'aeo-meta-description',
      name: 'Concise meta description for AI',
      status,
      weight: 2,
      message,
    });
  }

  // 4. Descriptive H1
  if (data.h1s.length === 0) {
    checks.push({
      id: 'aeo-h1-descriptive',
      name: 'Descriptive H1 heading',
      status: 'fail',
      weight: 1,
      message: 'No H1 heading found. Answer engines use the H1 to understand the page topic.',
    });
  } else {
    const h1 = data.h1s[0].trim().toLowerCase();
    const isGeneric = GENERIC_H1S.includes(h1) || h1.length < 4;

    checks.push({
      id: 'aeo-h1-descriptive',
      name: 'Descriptive H1 heading',
      status: isGeneric ? 'warn' : 'pass',
      weight: 1,
      message: isGeneric
        ? `H1 "${data.h1s[0]}" is too generic. Use a specific, descriptive heading that answer engines can use to identify your page topic.`
        : 'H1 is descriptive and helps answer engines understand the page topic.',
    });
  }

  // 5. FAQ/HowTo Schema
  const schemaTypes = parseJsonLdTypes(data.jsonLd);
  const foundAeoTypes = AEO_SCHEMA_TYPES.filter((t) => schemaTypes.includes(t));

  checks.push({
    id: 'aeo-faq-howto-schema',
    name: 'FAQ/HowTo schema markup',
    status: foundAeoTypes.length > 0 ? 'pass' : 'fail',
    weight: 2,
    message:
      foundAeoTypes.length > 0
        ? `Found answer-engine-friendly schema: ${foundAeoTypes.join(', ')}. These help AI extract structured answers from your page.`
        : 'No FAQPage, HowTo, or QAPage schema found. These structured data types are the most readily consumed by answer engines.',
    details:
      foundAeoTypes.length > 0 ? `Detected types: ${foundAeoTypes.join(', ')}` : undefined,
    fixSnippet:
      foundAeoTypes.length > 0
        ? undefined
        : '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "Your question here?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "Your concise answer here."\n    }\n  }]\n}\n</script>',
  });

  // 6. Question-Style Headings
  const questionHeadings = data.headings.filter((h) => {
    if (h.level < 2 || h.level > 3) return false;
    const text = h.text.toLowerCase().trim();
    if (text.endsWith('?')) return true;
    return QUESTION_WORDS.some((w) => text.startsWith(w + ' '));
  });

  checks.push({
    id: 'aeo-question-headings',
    name: 'Question-style headings',
    status: questionHeadings.length >= 2 ? 'pass' : questionHeadings.length === 1 ? 'warn' : 'fail',
    weight: 2,
    message:
      questionHeadings.length >= 2
        ? `Found ${questionHeadings.length} question-style headings. This helps answer engines extract Q&A pairs from your content.`
        : questionHeadings.length === 1
          ? 'Only 1 question-style heading found. Add more question-phrased H2/H3 headings to improve answer engine extraction.'
          : 'No question-style headings found. Use H2/H3 headings phrased as questions (starting with What, How, Why, etc.) so answer engines can extract Q&A pairs.',
    details:
      questionHeadings.length > 0
        ? `Found: ${questionHeadings.map((h) => `"${h.text}"`).join(', ')}`
        : undefined,
  });

  // 7. Content Depth for Citation
  checks.push({
    id: 'aeo-content-depth',
    name: 'Content depth for citation',
    status: data.bodyTextLength >= 500 ? 'pass' : data.bodyTextLength >= 200 ? 'warn' : 'fail',
    weight: 1,
    message:
      data.bodyTextLength >= 500
        ? 'Page has sufficient content depth for answer engines to cite as a source.'
        : data.bodyTextLength >= 200
          ? `Page has ${data.bodyTextLength} characters of body text. Answer engines prefer pages with substantial content (500+ characters) for citation.`
          : `Page has only ${data.bodyTextLength} characters of body text. Answer engines need more content to cite your page as a source.`,
  });

  // 8. Speakable Schema
  const hasSpeakableType = schemaTypes.includes('Speakable');
  const hasSpeakableProp = hasJsonLdProperty(data.jsonLd, 'speakable');

  checks.push({
    id: 'aeo-speakable',
    name: 'Speakable schema',
    status: hasSpeakableType || hasSpeakableProp ? 'pass' : 'warn',
    weight: 1,
    message:
      hasSpeakableType || hasSpeakableProp
        ? 'Speakable schema found. Voice assistants can identify which sections to read aloud.'
        : 'No Speakable schema found. Adding this helps voice assistants (Siri, Google Assistant) identify content to read aloud.',
    fixSnippet:
      hasSpeakableType || hasSpeakableProp
        ? undefined
        : '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "speakable": {\n    "@type": "SpeakableSpecification",\n    "cssSelector": [".main-content", "h1"]\n  }\n}\n</script>',
  });

  return checks;
}
