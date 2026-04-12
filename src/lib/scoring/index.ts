import type { CategoryResult, CategoryId, CheckResult } from '../scanner/types';
import { CATEGORY_WEIGHTS } from './weights';

function calculateCategoryScore(checks: CheckResult[]): number {
  let totalWeight = 0;
  let earnedScore = 0;

  for (const check of checks) {
    totalWeight += check.weight;
    if (check.status === 'pass') {
      earnedScore += check.weight;
    } else if (check.status === 'warn') {
      earnedScore += check.weight * 0.5;
    }
  }

  return totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;
}

export function scoreCategories(categories: CategoryResult[]): CategoryResult[] {
  return categories.map((cat) => ({
    ...cat,
    score: calculateCategoryScore(cat.checks),
  }));
}

export function calculateOverallScore(categories: CategoryResult[]): number {
  let total = 0;
  for (const cat of categories) {
    const weight = CATEGORY_WEIGHTS[cat.id as CategoryId] || 0;
    total += cat.score * weight;
  }
  return Math.round(total);
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
