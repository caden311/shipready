import type { CategoryId } from '../scanner/types';

export const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  'meta-head': 0.25,
  'social-sharing': 0.15,
  'discoverability': 0.20,
  'on-page': 0.20,
  'performance': 0.10,
  'structured-data': 0.10,
};
