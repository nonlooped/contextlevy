import * as core from '@actions/core';
import type * as github from '@actions/github';
import type { ContextLevySettings } from '../config/settings';
import { getHighImpactFiles } from '../core/analyze';
import { checkAnnotationLevelForCategory } from '../core/categories';
import type { FailDecision } from '../core/fail';
import { formatRiskLevel, getRiskLevel } from '../core/severity';
import { buildReviewSummary } from '../core/summary';
import type { PullRequestAnalysis } from '../core/types';
import { formatCompactTokens } from '../format/shared';

export const CHECK_RUN_NAME = 'ContextLevy';

const MAX_ANNOTATIONS = 50;

export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped';

export function resolveCheckConclusion(
  failDecision: FailDecision,
  riskLevel: ReturnType<typeof getRiskLevel>,
): CheckConclusion {
  if (failDecision.fail) {
    return 'failure';
  }
  if (riskLevel === 'High' || riskLevel === 'Critical') {
    return 'neutral';
  }
  return 'success';
}

function buildAnnotations(analysis: PullRequestAnalysis, maxItems: number) {
  const findings = getHighImpactFiles(analysis, maxItems).slice(0, MAX_ANNOTATIONS);

  return findings.map((file) => ({
    path: file.filename,
    // Category-level finding — no line-specific location in PR diff analysis.
    start_line: 1,
    end_line: 1,
    annotation_level: checkAnnotationLevelForCategory(file.category),
    message: `${file.label} (+${formatCompactTokens(file.estimatedTokens)} estimated tokens)`,
    title: file.category,
  }));
}

function buildCheckSummary(
  analysis: PullRequestAnalysis,
  settings: ContextLevySettings,
  failDecision: FailDecision,
  riskLevel: ReturnType<typeof getRiskLevel>,
): string {
  const reviewSummary = buildReviewSummary(analysis);
  const lines = [
    reviewSummary.headline,
    '',
    `Estimated **+${formatCompactTokens(analysis.totalEstimatedTokens)}** net-new context tokens across **${analysis.files.length}** analyzed file(s).`,
    `Risk level: ${formatRiskLevel(riskLevel)}`,
    `Estimation mode: \`${settings.estimationMode}\``,
  ];

  if (failDecision.fail) {
    lines.push('', `**Failed:** ${failDecision.reason ?? 'Threshold exceeded.'}`);
  }

  return lines.join('\n');
}

export function isCheckAccessError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { status?: number; message?: string };
  return (
    candidate.status === 403 ||
    candidate.status === 404 ||
    Boolean(candidate.message?.includes('Resource not accessible by integration'))
  );
}

export async function publishCheckRun(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  headSha: string,
  analysis: PullRequestAnalysis,
  settings: ContextLevySettings,
  failDecision: FailDecision,
): Promise<CheckConclusion> {
  const highImpact = getHighImpactFiles(analysis, settings.maxHighImpactItems);
  const riskLevel = getRiskLevel(
    analysis.totalEstimatedTokens,
    highImpact,
    settings.severityThresholds,
  );
  const conclusion = resolveCheckConclusion(failDecision, riskLevel);

  try {
    await octokit.rest.checks.create({
      owner,
      repo,
      name: CHECK_RUN_NAME,
      head_sha: headSha,
      status: 'completed',
      conclusion,
      output: {
        title: `Context risk: ${riskLevel}`,
        summary: buildCheckSummary(analysis, settings, failDecision, riskLevel),
        annotations: buildAnnotations(analysis, settings.maxHighImpactItems),
      },
    });
    core.info(`Published check run "${CHECK_RUN_NAME}" with conclusion ${conclusion}.`);
    return conclusion;
  } catch (error) {
    if (isCheckAccessError(error)) {
      core.warning(
        'ContextLevy could not publish a GitHub Check Run with the current token. Add checks: write permission.',
      );
      return conclusion;
    }
    throw error;
  }
}
