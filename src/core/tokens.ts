import { getEncoding, type Tiktoken } from 'js-tiktoken';
import type { EstimationMode } from './types';

const CHARS_PER_TOKEN = 4;
const TOKENS_PER_ADDED_LINE_FALLBACK = 10;

let tokenizer: Tiktoken | null = null;

function getTokenizer(): Tiktoken {
  if (!tokenizer) {
    tokenizer = getEncoding('cl100k_base');
  }
  return tokenizer;
}

function extractAddedTextFromPatch(patch: string): string {
  const lines: string[] = [];

  for (const line of patch.split('\n')) {
    if (/^\+\+\+ [ab]\//.test(line)) {
      continue;
    }
    if (line.startsWith('+')) {
      lines.push(line.slice(1));
    }
  }

  return lines.join('\n');
}

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

export function estimateTokensFromText(text: string, mode: EstimationMode = 'simple'): number {
  if (!text) {
    return 0;
  }

  if (mode === 'tokenizer') {
    return getTokenizer().encode(text).length;
  }

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateTokensFromPatch(
  patch: string | undefined,
  mode: EstimationMode = 'simple',
): number {
  if (!patch) {
    return 0;
  }

  if (mode === 'simple') {
    return Math.ceil(countAddedCharsInPatch(patch) / CHARS_PER_TOKEN);
  }

  return estimateTokensFromText(extractAddedTextFromPatch(patch), mode);
}

export function estimateTokensFromAdditions(additions: number): number {
  return additions * TOKENS_PER_ADDED_LINE_FALLBACK;
}
