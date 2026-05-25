export const COMPACT_MAX_FINDINGS = 3;
export const COMPACT_MAX_SUGGESTIONS = 2;

export function formatCompactTokens(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return value.toLocaleString('en-US');
}

export function formatShortPath(filename: string): string {
  const parts = filename.split('/');
  if (parts.length <= 2) {
    return filename;
  }
  return parts.slice(-2).join('/');
}

export function shortenFixSuggestion(suggestion: string): string {
  if (/keep build output out of version control/i.test(suggestion)) {
    return 'remove build output';
  }
  if (/add `coverage\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add `coverage/` to `.gitignore`';
  }
  if (/add coverage\/ to \.gitignore/i.test(suggestion)) {
    return 'add `coverage/` to `.gitignore`';
  }
  if (/avoid committing generated output unless required/i.test(suggestion)) {
    return 'avoid generated output';
  }
  if (/add `\*\.log` and `logs\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add logs to `.gitignore`';
  }
  if (/add \*\.log and logs\/ to \.gitignore/i.test(suggestion)) {
    return 'add logs to `.gitignore`';
  }
  if (/consider excluding these paths from agent indexing/i.test(suggestion)) {
    return 'exclude artifacts from agent indexing';
  }

  return suggestion.replace(/\.$/, '');
}

export function formatCostRange(cost: number): string {
  const low = cost * 0.5;
  const high = cost * 1.5;
  if (Math.abs(low - high) < 0.005) {
    return `~${formatUsd(cost)}`;
  }
  return `~${formatUsd(low)}–${formatUsd(high)}`;
}

export function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
