export type CheckStatus = 'pass' | 'fail' | 'warn';

export type CategoryId =
  | 'meta-head'
  | 'social-sharing'
  | 'discoverability'
  | 'on-page'
  | 'performance'
  | 'structured-data';

export interface CheckResult {
  id: string;
  name: string;
  status: CheckStatus;
  weight: number; // 1-3 importance within category
  message: string;
  details?: string;
  fixSnippet?: string;
}

export interface CategoryResult {
  id: CategoryId;
  name: string;
  score: number; // 0-100
  checks: CheckResult[];
}

export interface ScanResult {
  url: string;
  finalUrl: string;
  timestamp: string;
  overallScore: number;
  grade: string;
  categories: CategoryResult[];
  fixAllPrompt: string;
}

export interface ParsedSEOData {
  title: string | null;
  metaDescription: string | null;
  charset: boolean;
  viewport: string | null;
  htmlLang: string | null;
  canonical: string | null;
  favicon: boolean;
  ogTags: Record<string, string>;
  twitterTags: Record<string, string>;
  h1s: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string | null; loading: string | null }[];
  jsonLd: string[];
  scripts: { src: string | null; async: boolean; defer: boolean; isModule: boolean; inHead: boolean }[];
  links: { href: string; rel: string; hreflang?: string }[];
  anchors: { href: string; isInternal: boolean }[];
  bodyTextLength: number;
  noindex: boolean;
  xRobotsTag: string | null;
  responseHeaders: Record<string, string>;
  finalUrl: string;
  statusCode: number;
}

export interface ExternalCheckData {
  robotsTxt: { accessible: boolean; content: string | null; allowsCrawling: boolean; referencesSitemap: boolean };
  sitemap: { accessible: boolean; content: string | null };
  llmsTxt: { accessible: boolean };
  isHttps: boolean;
}

export interface ScanError {
  error: string;
  message: string;
}
