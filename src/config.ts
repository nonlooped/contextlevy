import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ContextCategory, CustomRule, EstimationMode, PricingProfile, SeverityThresholds } from './types';

export type CommentFormat = 'default' | 'compact';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContextLevyConfig {
  tokenThreshold?: number;
  largeFileTokenThreshold?: number;
  maxHighImpactItems?: number;
  showCostTable?: boolean;
  pricingProfiles?: PricingProfile[];
  commentFormat?: CommentFormat;
  ignorePaths?: string[];
  allowPaths?: string[];
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  estimationMode?: EstimationMode;
  customRules?: CustomRule[];
  severityThresholds?: Partial<SeverityThresholds>;
}

const SEVERITY_LEVELS: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];

const CONTEXT_CATEGORIES: ContextCategory[] = [
  'generated',
  'coverage',
  'lockfile',
  'build-output',
  'log',
  'snapshot',
  'agent-config',
  'minified',
  'vendor',
  'source-map',
  'protobuf',
  'openapi',
  'dependency-dir',
  'cache-dir',
  'test-output',
  'fixture',
  'binary-asset',
  'large-file',
  'other',
];

const ESTIMATION_MODES: EstimationMode[] = ['simple', 'tokenizer'];

export const DEFAULT_CONFIG_PATHS = [
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
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a finite non-negative number.`);
  }
  return value;
}

function readOptionalInteger(value: unknown, fieldName: string): number | undefined {
  const number = readOptionalNumber(value, fieldName);
  if (number === undefined) {
    return undefined;
  }
  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }
  return number;
}

function readStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`${fieldName}[${index}] must be a non-empty string.`);
    }
    return entry.trim();
  });
}

function parseSeverityLevel(value: unknown, fieldName: string): SeverityLevel | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be one of: low, medium, high, critical.`);
  }
  const normalized = value.trim().toLowerCase() as SeverityLevel;
  if (!SEVERITY_LEVELS.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: low, medium, high, critical.`);
  }
  return normalized;
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

function parseContextCategory(value: unknown, fieldName: string): ContextCategory {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a supported context category.`);
  }

  const normalized = value.trim().toLowerCase() as ContextCategory;
  if (!CONTEXT_CATEGORIES.includes(normalized)) {
    throw new Error(`${fieldName} must be a supported context category.`);
  }

  return normalized;
}

export function parseEstimationMode(value: unknown, fieldName: string): EstimationMode | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be "simple" or "tokenizer".`);
  }

  const normalized = value.trim().toLowerCase() as EstimationMode;
  if (!ESTIMATION_MODES.includes(normalized)) {
    throw new Error(`${fieldName} must be "simple" or "tokenizer".`);
  }

  return normalized;
}

export function parseCustomRulesValue(value: unknown): CustomRule[] {
  if (!Array.isArray(value)) {
    throw new Error('custom-rules must be an array.');
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`custom-rules[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const paths = readStringArray(record.paths, `custom-rules[${index}].paths`);
    if (!paths || paths.length === 0) {
      throw new Error(`custom-rules[${index}].paths must contain at least one glob pattern.`);
    }

    const label = record.label;
    if (typeof label !== 'string' || label.trim().length === 0) {
      throw new Error(`custom-rules[${index}].label must be a non-empty string.`);
    }

    const category = parseContextCategory(record.category, `custom-rules[${index}].category`);
    const suggestion =
      record.suggestion === undefined || record.suggestion === null
        ? undefined
        : typeof record.suggestion === 'string'
          ? record.suggestion.trim() || undefined
          : (() => {
              throw new Error(`custom-rules[${index}].suggestion must be a string.`);
            })();

    const name =
      record.name === undefined || record.name === null
        ? undefined
        : typeof record.name === 'string'
          ? record.name.trim() || undefined
          : (() => {
              throw new Error(`custom-rules[${index}].name must be a string.`);
            })();

    return {
      name,
      paths,
      category,
      label: label.trim(),
      suggestion,
    };
  });
}

export function parseSeverityThresholdsValue(value: unknown): Partial<SeverityThresholds> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('severity-thresholds must be an object.');
  }

  const record = value as Record<string, unknown>;
  const thresholds: Partial<SeverityThresholds> = {};

  const mediumTokens = readOptionalInteger(
    readConfigValue(record, 'mediumTokens', 'medium-tokens') ?? record.medium,
    'severity-thresholds.medium-tokens',
  );
  const highTokens = readOptionalInteger(
    readConfigValue(record, 'highTokens', 'high-tokens') ?? record.high,
    'severity-thresholds.high-tokens',
  );
  const criticalTokens = readOptionalInteger(
    readConfigValue(record, 'criticalTokens', 'critical-tokens') ?? record.critical,
    'severity-thresholds.critical-tokens',
  );
  const mediumHighImpactCount = readOptionalInteger(
    readConfigValue(record, 'mediumHighImpactCount', 'medium-high-impact-count'),
    'severity-thresholds.medium-high-impact-count',
  );
  const highHighImpactCount = readOptionalInteger(
    readConfigValue(record, 'highHighImpactCount', 'high-high-impact-count'),
    'severity-thresholds.high-high-impact-count',
  );
  const criticalHighImpactCount = readOptionalInteger(
    readConfigValue(record, 'criticalHighImpactCount', 'critical-high-impact-count'),
    'severity-thresholds.critical-high-impact-count',
  );

  if (mediumTokens !== undefined) thresholds.mediumTokens = mediumTokens;
  if (highTokens !== undefined) thresholds.highTokens = highTokens;
  if (criticalTokens !== undefined) thresholds.criticalTokens = criticalTokens;
  if (mediumHighImpactCount !== undefined) {
    thresholds.mediumHighImpactCount = mediumHighImpactCount;
  }
  if (highHighImpactCount !== undefined) thresholds.highHighImpactCount = highHighImpactCount;
  if (criticalHighImpactCount !== undefined) {
    thresholds.criticalHighImpactCount = criticalHighImpactCount;
  }

  return thresholds;
}

function normalizeConfig(raw: unknown, sourcePath: string): ContextLevyConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${sourcePath} must contain a JSON or YAML object.`);
  }

  const record = raw as Record<string, unknown>;
  const pricingProfilesRaw = readConfigValue(record, 'pricingProfiles', 'pricing-profiles');
  const customRulesRaw = readConfigValue(record, 'customRules', 'custom-rules');
  const severityThresholdsRaw = readConfigValue(record, 'severityThresholds', 'severity-thresholds');

  const config: ContextLevyConfig = {
    tokenThreshold: readOptionalInteger(
      readConfigValue(record, 'tokenThreshold', 'token-threshold'),
      'token-threshold',
    ),
    largeFileTokenThreshold: readOptionalInteger(
      readConfigValue(record, 'largeFileTokenThreshold', 'large-file-token-threshold'),
      'large-file-token-threshold',
    ),
    maxHighImpactItems: readOptionalInteger(
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
    ignorePaths: readStringArray(
      readConfigValue(record, 'ignorePaths', 'ignore-paths'),
      'ignore-paths',
    ),
    allowPaths: readStringArray(
      readConfigValue(record, 'allowPaths', 'allow-paths'),
      'allow-paths',
    ),
    failOnSeverity: parseSeverityLevel(
      readConfigValue(record, 'failOnSeverity', 'fail-on-severity'),
      'fail-on-severity',
    ),
    failAboveTokens: readOptionalInteger(
      readConfigValue(record, 'failAboveTokens', 'fail-above-tokens'),
      'fail-above-tokens',
    ),
    estimationMode: parseEstimationMode(
      readConfigValue(record, 'estimationMode', 'estimation-mode'),
      'estimation-mode',
    ),
  };

  if (pricingProfilesRaw !== undefined) {
    config.pricingProfiles = parsePricingProfilesValue(pricingProfilesRaw);
  }

  if (customRulesRaw !== undefined) {
    config.customRules = parseCustomRulesValue(customRulesRaw);
  }

  if (severityThresholdsRaw !== undefined) {
    config.severityThresholds = parseSeverityThresholdsValue(severityThresholdsRaw);
  }

  return config;
}

export function parseConfigContents(contents: string, sourcePath: string): ContextLevyConfig {
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

export function resolveConfigPath(workspaceRoot: string): string | null {
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
