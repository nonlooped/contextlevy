import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveGithubToken } from './auth';
import { analyzePullRequestFiles } from './analyze';
import { COMMENT_MARKER, formatComment } from './comment';
import { loadConfigFile, resolveConfigPath } from './config';
import { resolveSettings } from './settings';
import type { PullRequestFileLike } from './types';

async function listAllPullRequestFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestFileLike[]> {
  const files: PullRequestFileLike[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.listFiles,
    {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    },
  )) {
    for (const file of response.data) {
      files.push({
        filename: file.filename,
        status: file.status as PullRequestFileLike['status'],
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      });
    }
  }

  return files;
}

function isCommentAccessError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { status?: number; message?: string };
  return (
    candidate.status === 403 ||
    Boolean(candidate.message?.includes('Resource not accessible by integration'))
  );
}

async function upsertComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

  if (existing) {
    try {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated ContextLevy comment (${existing.id}).`);
      return;
    } catch (error) {
      if (!isCommentAccessError(error)) {
        throw error;
      }

      core.info(
        `Cannot update existing ContextLevy comment (${existing.id}) with the current token; creating a new comment.`,
      );
    }
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  core.info('Created ContextLevy comment.');
}

export async function run(): Promise<void> {
  const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  const configPathInput = core.getInput('config-path');
  const config = loadConfigFile(workspaceRoot, configPathInput);
  const resolvedConfigPath = resolveConfigPath(workspaceRoot, configPathInput);

  if (resolvedConfigPath) {
    core.info(`Loaded ContextLevy config from ${resolvedConfigPath}.`);
  }

  const settings = resolveSettings(config, {
    tokenThreshold: core.getInput('token-threshold'),
    largeFileTokenThreshold: core.getInput('large-file-token-threshold'),
    maxHighImpactItems: core.getInput('max-high-impact-items'),
    showCostTable: core.getInput('show-cost-table'),
    pricingProfiles: core.getInput('pricing-profiles'),
    modelPricing: core.getInput('model-pricing'),
    commentFormat: core.getInput('comment-format'),
  });

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

  core.info(`Analyzing PR #${pullNumber} in ${owner}/${repo}`);

  const files = await listAllPullRequestFiles(octokit, owner, repo, pullNumber);
  const analysis = analyzePullRequestFiles(files, {
    largeFileTokenThreshold: settings.largeFileTokenThreshold,
  });

  core.setOutput('total-estimated-tokens', String(analysis.totalEstimatedTokens));
  core.setOutput('analyzed-file-count', String(analysis.files.length));

  if (analysis.totalEstimatedTokens < settings.tokenThreshold) {
    core.info(
      `Estimated tokens (${analysis.totalEstimatedTokens}) below threshold (${settings.tokenThreshold}) — no comment posted.`,
    );
    return;
  }

  const body = formatComment(analysis, {
    maxHighImpactItems: settings.maxHighImpactItems,
    showCostTable: settings.showCostTable,
    pricingProfiles: settings.pricingProfiles,
    commentFormat: settings.commentFormat,
  });

  try {
    await upsertComment(octokit, owner, repo, pullNumber, body);
  } catch (error) {
    if (source !== 'app' || !isCommentAccessError(error)) {
      throw error;
    }

    const fallbackToken = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!fallbackToken || fallbackToken === token) {
      throw new Error(
        'ContextLevy GitHub App token could not write PR comments. Grant the app Issues: Read & write and Pull requests: Read & write permissions, then accept the updated installation request.',
      );
    }

    core.warning(
      'ContextLevy GitHub App token could not write PR comments; retrying comment upsert with GITHUB_TOKEN.',
    );
    core.setOutput('token-source', 'GITHUB_TOKEN');
    await upsertComment(github.getOctokit(fallbackToken), owner, repo, pullNumber, body);
  }
}

if (require.main === module) {
  run().catch((error: unknown) => {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  });
}
