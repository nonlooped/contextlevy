import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execGit } from './repo';

export interface TrackedFileContent {
  filename: string;
  content: string;
  byteSize: number;
}

export function listTrackedFiles(cwd?: string): string[] {
  const output = execGit(['ls-files', '-z'], { cwd, encoding: 'buffer' }) as Buffer;

  const filenames: string[] = [];
  let start = 0;

  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === 0) {
      if (index > start) {
        filenames.push(output.subarray(start, index).toString('utf8'));
      }
      start = index + 1;
    }
  }

  return filenames;
}

export function readTrackedFile(filename: string, cwd?: string): TrackedFileContent | null {
  const fullPath = cwd ? join(cwd, filename) : filename;

  try {
    const stats = statSync(fullPath);
    if (!stats.isFile()) {
      return null;
    }

    const buffer = readFileSync(fullPath);
    if (buffer.includes(0)) {
      return {
        filename,
        content: '',
        byteSize: buffer.byteLength,
      };
    }

    const content = buffer.toString('utf8');
    return {
      filename,
      content,
      byteSize: buffer.byteLength,
    };
  } catch {
    return null;
  }
}

export function loadTrackedFiles(cwd?: string): {
  filenames: string[];
  files: TrackedFileContent[];
} {
  const filenames = listTrackedFiles(cwd);
  const files: TrackedFileContent[] = [];

  for (const filename of filenames) {
    const file = readTrackedFile(filename, cwd);
    if (file) {
      files.push(file);
    }
  }

  return { filenames, files };
}
