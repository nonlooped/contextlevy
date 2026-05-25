import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfigContents } from './parse';
import type { ContextLevyConfig } from './types';

export const DEFAULT_CONFIG_PATHS = [
  'contextlevy.config.yml',
  'contextlevy.config.yaml',
  'contextlevy.config.json',
  '.github/contextlevy.config.yml',
  '.github/contextlevy.config.yaml',
  '.github/contextlevy.config.json',
  '.contextlevy.yml',
  '.contextlevy.yaml',
  '.contextlevy.json',
  '.github/contextlevy.yml',
  '.github/contextlevy.yaml',
  '.github/contextlevy.json',
  'contextlevy.yml',
  'contextlevy.yaml',
  'contextlevy.json',
] as const;

function resolveConfigPath(workspaceRoot: string): string | null {
  for (const candidate of DEFAULT_CONFIG_PATHS) {
    const resolved = join(workspaceRoot, candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

export function loadConfigFile(workspaceRoot: string): ContextLevyConfig | null {
  const resolvedPath = resolveConfigPath(workspaceRoot);
  if (!resolvedPath) {
    return null;
  }

  const contents = readFileSync(resolvedPath, 'utf8');
  return parseConfigContents(contents, resolvedPath);
}

export type RepositoryConfigReader = (path: string, ref: string) => Promise<string | null>;

export async function loadConfigFromRepository(
  readConfig: RepositoryConfigReader,
  ref: string,
): Promise<ContextLevyConfig | null> {
  for (const candidate of DEFAULT_CONFIG_PATHS) {
    const contents = await readConfig(candidate, ref);
    if (contents !== null) {
      return parseConfigContents(contents, `${candidate}@${ref}`);
    }
  }

  return null;
}
