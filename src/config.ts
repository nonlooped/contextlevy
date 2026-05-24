import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { PricingProfile } from './types';

export type CommentFormat = 'default' | 'compact';

export interface ContextLevyConfig {
  tokenThreshold?: number;
  largeFileTokenThreshold?: number;
  maxHighImpactItems?: number;
  showCostTable?: boolean;
  pricingProfiles?: PricingProfile[];
  commentFormat?: CommentFormat;
}

export const DEFAULT_CONFIG_PATHS = [
  '.contextlevy.yml',
  '.contextlevy.yaml',
  '.contextlevy.json',
  'contextlevy.yml',
  'contextlevy.yaml',
  'contextlevy.json',
] as const;

function readConfigValue(
  record: Record<string, unknown>,
  camelKey: string,
  kebabKey: string,
): unknown {
  if (record[camelKey] !== undefined) {
    return record[camelKey];
  }
  return record[kebabKey];
}

function readOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return value;
}

function readOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }
  throw new Error(`${fieldName} must be a boolean.`);
}

export function parseCommentFormat(value: unknown, fieldName: string): CommentFormat | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be "default" or "compact".`);
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'default') {
    return 'default';
  }
  if (normalized === 'compact') {
    return 'compact';
  }

  throw new Error(`${fieldName} must be "default" or "compact".`);
}

function readProfileName(record: Record<string, unknown>, index: number): string {
  const name = record.name ?? record.profile;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(
      `pricing-profiles[${index}] must include a non-empty "name" or "profile" string.`,
    );
  }

  return name.trim();
}

export function parsePricingProfilesValue(value: unknown): PricingProfile[] {
  if (!Array.isArray(value)) {
    throw new Error('pricing-profiles must be an array.');
  }

  if (value.length === 0) {
    return [];
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`pricing-profiles[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const inputCostPerMillion =
      record.inputCostPerMillion ?? record['input-cost-per-million'];

    if (typeof inputCostPerMillion !== 'number' || inputCostPerMillion < 0) {
      throw new Error(
        `pricing-profiles[${index}].inputCostPerMillion must be a non-negative number.`,
      );
    }

    return {
      name: readProfileName(record, index),
      inputCostPerMillion,
    };
  });
}

function normalizeConfig(raw: unknown, sourcePath: string): ContextLevyConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${sourcePath} must contain a JSON or YAML object.`);
  }

  const record = raw as Record<string, unknown>;
  const pricingProfilesRaw = readConfigValue(record, 'pricingProfiles', 'pricing-profiles');

  const config: ContextLevyConfig = {
    tokenThreshold: readOptionalNumber(
      readConfigValue(record, 'tokenThreshold', 'token-threshold'),
      'token-threshold',
    ),
    largeFileTokenThreshold: readOptionalNumber(
      readConfigValue(record, 'largeFileTokenThreshold', 'large-file-token-threshold'),
      'large-file-token-threshold',
    ),
    maxHighImpactItems: readOptionalNumber(
      readConfigValue(record, 'maxHighImpactItems', 'max-high-impact-items'),
      'max-high-impact-items',
    ),
    showCostTable: readOptionalBoolean(
      readConfigValue(record, 'showCostTable', 'show-cost-table'),
      'show-cost-table',
    ),
    commentFormat: parseCommentFormat(
      readConfigValue(record, 'commentFormat', 'comment-format'),
      'comment-format',
    ),
  };

  if (pricingProfilesRaw !== undefined) {
    config.pricingProfiles = parsePricingProfilesValue(pricingProfilesRaw);
  }

  return config;
}

function parseConfigContents(contents: string, sourcePath: string): ContextLevyConfig {
  const trimmed = contents.trim();
  if (!trimmed) {
    throw new Error(`${sourcePath} is empty.`);
  }

  let parsed: unknown;
  if (sourcePath.endsWith('.json')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`${sourcePath} must be valid JSON.`);
    }
  } else {
    try {
      parsed = parseYaml(trimmed);
    } catch {
      throw new Error(`${sourcePath} must be valid YAML.`);
    }
  }

  return normalizeConfig(parsed, sourcePath);
}

export function resolveConfigPath(workspaceRoot: string, configPath?: string): string | null {
  if (configPath?.trim()) {
    const resolved = resolve(workspaceRoot, configPath.trim());
    return existsSync(resolved) ? resolved : null;
  }

  for (const candidate of DEFAULT_CONFIG_PATHS) {
    const resolved = join(workspaceRoot, candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

export function loadConfigFile(workspaceRoot: string, configPath?: string): ContextLevyConfig | null {
  const resolvedPath = resolveConfigPath(workspaceRoot, configPath);
  if (!resolvedPath) {
    return null;
  }

  const contents = readFileSync(resolvedPath, 'utf8');
  return parseConfigContents(contents, resolvedPath);
}
