import type { CategoryResult, CheckResult } from '../scanner/types';

export function buildFixAllPrompt(url: string, categories: CategoryResult[]): string {
  const failedChecks: CheckResult[] = [];
  const warnChecks: CheckResult[] = [];

  for (const cat of categories) {
    for (const check of cat.checks) {
      if (check.status === 'fail') failedChecks.push(check);
      else if (check.status === 'warn') warnChecks.push(check);
    }
  }

  if (failedChecks.length === 0 && warnChecks.length === 0) {
    return 'No issues found. Your SEO looks great!';
  }

  const lines: string[] = [
    `Fix the following SEO issues on the site at ${url}.`,
    '',
    'Do not remove any existing functionality. Preserve existing meta tags that are already correct.',
    'Use the project\'s existing patterns and conventions.',
    '',
  ];

  if (failedChecks.length > 0) {
    lines.push('## Critical issues (must fix):');
    lines.push('');
    for (const check of failedChecks) {
      lines.push(`- **${check.name}**: ${check.message}`);
      if (check.fixSnippet) {
        lines.push(`  Fix: \`\`\`\n${indentSnippet(check.fixSnippet, '  ')}\n  \`\`\``);
      }
    }
    lines.push('');
  }

  if (warnChecks.length > 0) {
    lines.push('## Warnings (should fix):');
    lines.push('');
    for (const check of warnChecks) {
      lines.push(`- **${check.name}**: ${check.message}`);
      if (check.fixSnippet) {
        lines.push(`  Fix: \`\`\`\n${indentSnippet(check.fixSnippet, '  ')}\n  \`\`\``);
      }
    }
    lines.push('');
  }

  lines.push('## Guidelines:');
  lines.push('- If a layout or head component already exists, modify it rather than creating a new one');
  lines.push('- Add meta tags and structured data to the <head> section');
  lines.push('- Create any missing files (robots.txt, sitemap config, etc.) in the appropriate location');

  return lines.join('\n');
}

function indentSnippet(snippet: string, indent: string): string {
  return snippet
    .split('\n')
    .map((line) => indent + line)
    .join('\n');
}
