import type { CategoryId } from '../scanner/types';

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'meta-head': 0.21,
  'social-sharing': 0.13,
  'discoverability': 0.18,
  'on-page': 0.18,
  'performance': 0.08,
  'structured-data': 0.07,
  'aeo': 0.15,
};
