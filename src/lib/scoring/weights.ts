import type { CategoryId } from '../scanner/types';

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'meta-head': 0.23,
  'social-sharing': 0.14,
  'discoverability': 0.19,
  'on-page': 0.19,
  'performance': 0.09,
  'structured-data': 0.08,
  'aeo': 0.08,
};
