import { readFileSync } from 'node:fs';
import { loadConfigFile } from '../config/load';
import { resolveSettings } from '../config/settings';
import { getHighImpactFiles } from '../core/analyze';
import { computeRepoContextDebt } from '../core/scan';
import { getRiskLevel } from '../core/severity';
import {
  buildBadgeMarkdown,
  buildDebtBadgeUrl,
  buildRiskBadgeUrl,
  buildTokenBadgeUrl,
} from '../format/badge';
import { loadAnalysis } from './analysis';
import type { CliBadgeArgs } from './args';

export interface CliBadgeResult {
  exitCode: number;
  output: string;
}

interface BadgeJsonInput {
  scan?: {
    debt?: {
      score: number;
      grade: import('../core/scan').RepoDebtGrade;
    };
  };
  analysis?: import('../core/types').PullRequestAnalysis;
  riskLevel?: ReturnType<typeof getRiskLevel>;
}

function formatBadgeOutput(
  url: string,
  alt: string,
  format: CliBadgeArgs['format'],
): CliBadgeResult {
  if (format === 'url') {
    return { exitCode: 0, output: url };
  }
  if (format === 'json') {
    return {
      exitCode: 0,
      output: JSON.stringify({ url, markdown: buildBadgeMarkdown(url, alt) }, null, 2),
    };
  }
  return { exitCode: 0, output: buildBadgeMarkdown(url, alt) };
}

function badgeFromJsonInput(args: CliBadgeArgs, cwd: string): CliBadgeResult | null {
  if (!args.input) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(args.input, 'utf8')) as BadgeJsonInput;

  if (args.style === 'debt' && parsed.scan?.debt) {
    const url = buildDebtBadgeUrl(parsed.scan.debt.score, parsed.scan.debt.grade);
    return formatBadgeOutput(url, 'Context debt', args.format);
  }

  if (!parsed.analysis) {
    throw new Error('Badge input JSON must include analysis or scan.debt.');
  }

  const config = loadConfigFile(cwd);
  const settings = resolveSettings(config);
  const highImpact = getHighImpactFiles(parsed.analysis, parsed.analysis.files.length);
  const riskLevel =
    parsed.riskLevel ??
    getRiskLevel(parsed.analysis.totalEstimatedTokens, highImpact, settings.severityThresholds);
  const url =
    args.style === 'tokens'
      ? buildTokenBadgeUrl(parsed.analysis)
      : buildRiskBadgeUrl(riskLevel, parsed.analysis.totalEstimatedTokens);

  return formatBadgeOutput(url, 'Context risk', args.format);
}

export function runCliBadge(args: CliBadgeArgs, cwd: string): CliBadgeResult {
  try {
    const fromInput = badgeFromJsonInput(args, cwd);
    if (fromInput) {
      return fromInput;
    }

    if (args.style === 'debt' || args.from === 'scan') {
      const { analysis, trackedFileCount } = loadAnalysis({
        source: 'scan',
        base: args.base,
        staged: false,
        cwd,
      });
      const debt = computeRepoContextDebt(analysis, trackedFileCount ?? 0);
      const url = buildDebtBadgeUrl(debt.score, debt.grade);
      return formatBadgeOutput(url, 'Context debt', args.format);
    }

    const { analysis } = loadAnalysis({
      source: 'check',
      base: args.base,
      staged: args.staged,
      cwd,
    });
    const config = loadConfigFile(cwd);
    const settings = resolveSettings(config);
    const highImpact = getHighImpactFiles(analysis, analysis.files.length);
    const riskLevel = getRiskLevel(
      analysis.totalEstimatedTokens,
      highImpact,
      settings.severityThresholds,
    );

    const url =
      args.style === 'tokens'
        ? buildTokenBadgeUrl(analysis)
        : buildRiskBadgeUrl(riskLevel, analysis.totalEstimatedTokens);

    return formatBadgeOutput(url, 'Context risk', args.format);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: message };
  }
}
