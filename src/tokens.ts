const CHARS_PER_TOKEN = 4;
const TOKENS_PER_ADDED_LINE_FALLBACK = 10;

export function countAddedCharsInPatch(patch: string): number {
  let total = 0;

  for (const line of patch.split('\n')) {
    if (/^\+\+\+ [ab]\//.test(line)) {
      continue;
    }
    if (line.startsWith('+')) {
      total += line.slice(1).length;
    }
  }

  return total;
}

export function estimateTokensFromPatch(patch: string | undefined): number {
  if (!patch) {
    return 0;
  }

  const addedChars = countAddedCharsInPatch(patch);
  return Math.ceil(addedChars / CHARS_PER_TOKEN);
}

export function estimateTokensFromAdditions(additions: number): number {
  return additions * TOKENS_PER_ADDED_LINE_FALLBACK;
}
