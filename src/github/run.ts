import * as core from '@actions/core';
import * as github from '@actions/github';
import { loadConfigFile } from '../config/load';
import { resolveSettings } from '../config/settings';
import type { ContextLevyConfig } from '../config/types';
import { analyzePullRequestFiles } from '../core/analyze';
import { shouldPostComment } from '../core/comment-gate';
import { shouldFailRun } from '../core/fail';
import { formatComment } from '../format/comment';
import { resolveGithubToken } from './auth';
import { isCommentAccessError, upsertComment } from './comments';
import { loadBaseConfig } from './config-loader';
import { listAllPullRequestFiles } from './files';
import { writeJobSummary } from './summary';

async function getAuthenticatedLogin(
  octokit: ReturnType<typeof github.getOctokit>,
): Promise<string | undefined> {
  try {
    const response = await octokit.rest.users.getAuthenticated();
    return response.data.login;
  } catch (error) {
    core.info(
      `Could not resolve authenticated GitHub login for comment ownership checks: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

export async function run(): Promise<void> {
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not a pull_request event — skipping.');
    return;
  }

  const pullNumber = context.payload.pull_request.number;
  const { owner, repo } = context.repo;

  const { token, source } = await resolveGithubToken(owner, repo);
  core.setOutput('token-source', source);

  const octokit = github.getOctokit(token);
  const baseSha = context.payload.pull_request.base?.sha;
  const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  let config: ContextLevyConfig | null = null;

  if (baseSha) {
    config = await loadBaseConfig(octokit, owner, repo, baseSha);
    if (config) {
      core.info(`Loaded ContextLevy config from base ref ${baseSha}.`);
    }
  }

  if (!config && !baseSha) {
    config = loadConfigFile(workspaceRoot);
    if (config) {
      core.info('Loaded ContextLevy config from workspace.');
    }
  }

  if (!config) {
    core.info('No ContextLevy config file found — using defaults.');
  }

  const settings = resolveSettings(config);

  core.info(`Analyzing PR #${pullNumber} in ${owner}/${repo}`);

  const files = await listAllPullRequestFiles(octokit, owner, repo, pullNumber);
  const analysis = analyzePullRequestFiles(files, {
    largeFileTokenThreshold: settings.largeFileTokenThreshold,
    ignorePaths: settings.ignorePaths,
    allowPaths: settings.allowPaths,
    estimationMode: settings.estimationMode,
    customRules: settings.customRules,
  });

  core.setOutput('total-estimated-tokens', String(analysis.totalEstimatedTokens));
  core.setOutput('analyzed-file-count', String(analysis.files.length));
  core.setOutput('estimation-mode', settings.estimationMode);

  const failDecision = shouldFailRun(
    analysis,
    {
      failOnSeverity: settings.failOnSeverity,
      failAboveTokens: settings.failAboveTokens,
      failOnCategories: settings.failOnCategories,
      warnOnlyCategories: settings.warnOnlyCategories,
      severityThresholds: settings.severityThresholds,
    },
    settings.maxHighImpactItems,
  );

  await writeJobSummary(analysis, settings, failDecision);

  if (failDecision.fail) {
    core.setFailed(failDecision.reason ?? 'ContextLevy fail threshold exceeded.');
  }

  if (!shouldPostComment(analysis, settings)) {
    core.info('Comment thresholds not met — no comment posted.');
    return;
  }

  const body = formatComment(analysis, {
    maxHighImpactItems: settings.maxHighImpactItems,
    showCostTable: settings.showCostTable,
    pricingProfiles: settings.pricingProfiles,
    commentFormat: settings.commentFormat,
    severityThresholds: settings.severityThresholds,
  });

  const botLogin = await getAuthenticatedLogin(octokit);
  try {
    const posted = await upsertComment(octokit, owner, repo, pullNumber, body, { botLogin });
    if (posted) {
      return;
    }

    if (source !== 'app') {
      return;
    }
  } catch (error) {
    if (source !== 'app' || !isCommentAccessError(error)) {
      throw error;
    }
  }

  const fallbackToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
  if (!fallbackToken || fallbackToken === token) {
    core.warning(
      'ContextLevy GitHub App token could not write PR comments, and no distinct GITHUB_TOKEN fallback was available.',
    );
    return;
  }

  core.warning(
    'ContextLevy GitHub App token could not write PR comments; retrying comment upsert with GITHUB_TOKEN.',
  );
  core.setOutput('token-source', 'GITHUB_TOKEN');
  const fallbackOctokit = github.getOctokit(fallbackToken);
  await upsertComment(fallbackOctokit, owner, repo, pullNumber, body, {
    botLogin: await getAuthenticatedLogin(fallbackOctokit),
  });
}
