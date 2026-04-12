import type { CategoryResult, ParsedSEOData, ExternalCheckData } from '../scanner/types';
import { checkMetaHead } from './meta-head';
import { checkSocialSharing } from './social-sharing';
import { checkDiscoverability } from './discoverability';
import { checkOnPage } from './on-page';
import { checkPerformance } from './performance';
import { checkStructuredData } from './structured-data';

export function runAllChecks(
  data: ParsedSEOData,
  external: ExternalCheckData
): CategoryResult[] {
  return [
    {
      id: 'meta-head',
      name: 'Meta & Head',
      score: 0, // calculated by scoring module
      checks: checkMetaHead(data),
    },
    {
      id: 'social-sharing',
      name: 'Social & Sharing',
      score: 0,
      checks: checkSocialSharing(data),
    },
    {
      id: 'discoverability',
      name: 'Discoverability',
      score: 0,
      checks: checkDiscoverability(data, external),
    },
    {
      id: 'on-page',
      name: 'On-Page Structure',
      score: 0,
      checks: checkOnPage(data),
    },
    {
      id: 'performance',
      name: 'Performance',
      score: 0,
      checks: checkPerformance(data),
    },
    {
      id: 'structured-data',
      name: 'Structured Data',
      score: 0,
      checks: checkStructuredData(data),
    },
  ];
}
