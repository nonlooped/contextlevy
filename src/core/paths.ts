function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/').replace(/\/+$/, '');
  let regex = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      regex += '.*';
      index += 1;
      if (normalized[index + 1] === '/') index += 1;
      continue;
    }
    if (char === '*') {
      regex += '[^/]*';
      continue;
    }
    regex += escapeRegex(char);
  }
  regex += '$';
  return new RegExp(regex);
}

export function matchesPathPattern(filename: string, pattern: string): boolean {
  const normalizedFile = filename.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');
  return globToRegExp(normalizedPattern).test(normalizedFile);
}

export function matchesAnyPathPattern(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesPathPattern(filename, pattern));
}
