import type { ScanResult, ExternalCheckData, ScanError } from './types';
import { validateUrl, fetchFollowingRedirects, fetchWithSafety } from '../security/url-validator';
import { parseHTML } from './html-parser';
import { runAllChecks } from '../checks/index';
import { scoreCategories, calculateOverallScore, scoreToGrade } from '../scoring/index';
import { buildFixAllPrompt } from '../fix-generator/index';

export async function scanUrl(inputUrl: string): Promise<ScanResult | ScanError> {
  // Validate URL
  const validation = validateUrl(inputUrl);
  if (!validation.valid || !validation.url) {
    return { error: 'invalid_url', message: validation.error || 'Invalid URL.' };
  }

  const targetUrl = validation.url.toString();

  try {
    // Fetch main page and external resources in parallel
    const [mainResponse, externalData] = await Promise.all([
      fetchFollowingRedirects(targetUrl),
      fetchExternalResources(validation.url),
    ]);

    if (!mainResponse.ok && mainResponse.status !== 200) {
      // Still parse non-200 responses but note it
      if (mainResponse.status >= 400) {
        return {
          error: 'fetch_failed',
          message: `The URL returned HTTP ${mainResponse.status} (${mainResponse.statusText}). Make sure the URL is correct and the site is live.`,
        };
      }
    }

    const finalUrl = mainResponse.headers.get('x-shipready-final-url') || targetUrl;

    // Parse HTML
    const parsedData = await parseHTML(mainResponse, finalUrl);

    // Run all checks
    let categories = runAllChecks(parsedData, externalData);

    // Score categories
    categories = scoreCategories(categories);

    // Calculate overall score and grade
    const overallScore = calculateOverallScore(categories);
    const grade = scoreToGrade(overallScore);

    // Generate fix-all prompt
    const fixAllPrompt = buildFixAllPrompt(finalUrl, categories);

    return {
      url: targetUrl,
      finalUrl,
      timestamp: new Date().toISOString(),
      overallScore,
      grade,
      categories,
      fixAllPrompt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred while scanning.';
    return { error: 'scan_failed', message };
  }
}

async function fetchExternalResources(baseUrl: URL): Promise<ExternalCheckData> {
  const origin = baseUrl.origin;
  const isHttps = baseUrl.protocol === 'https:';

  const [robotsResult, sitemapResult, sitemapIndexResult, llmsResult] = await Promise.allSettled([
    fetchWithSafety(`${origin}/robots.txt`, { timeoutMs: 5000 }),
    fetchWithSafety(`${origin}/sitemap.xml`, { timeoutMs: 5000 }),
    fetchWithSafety(`${origin}/sitemap-index.xml`, { timeoutMs: 5000 }),
    fetchWithSafety(`${origin}/llms.txt`, { timeoutMs: 5000 }),
  ]);

  // Process robots.txt
  let robotsTxt = { accessible: false, content: null as string | null, allowsCrawling: true, referencesSitemap: false };
  if (robotsResult.status === 'fulfilled' && robotsResult.value.ok) {
    const content = await robotsResult.value.text();
    robotsTxt = {
      accessible: true,
      content,
      allowsCrawling: !content.toLowerCase().includes('disallow: /\n') || content.toLowerCase().includes('allow: /\n'),
      referencesSitemap: content.toLowerCase().includes('sitemap:'),
    };
  }

  // Process sitemap
  let sitemapAccessible = false;
  let sitemapContent: string | null = null;
  if (sitemapResult.status === 'fulfilled' && sitemapResult.value.ok) {
    sitemapAccessible = true;
    sitemapContent = await sitemapResult.value.text();
  } else if (sitemapIndexResult.status === 'fulfilled' && sitemapIndexResult.value.ok) {
    sitemapAccessible = true;
    sitemapContent = await sitemapIndexResult.value.text();
  }

  // Process llms.txt
  const llmsAccessible =
    llmsResult.status === 'fulfilled' && llmsResult.value.ok;

  return {
    robotsTxt,
    sitemap: { accessible: sitemapAccessible, content: sitemapContent },
    llmsTxt: { accessible: llmsAccessible },
    isHttps,
  };
}
