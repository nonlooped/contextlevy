import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzePullRequestFiles } from './analyze';
import { COMMENT_MARKER, formatComment } from './comment';
import { parseBooleanInput, parsePricingProfiles } from './pricing';
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

  const existing = comments.find(
    (comment) =>
      comment.user?.type === 'Bot' && comment.body?.includes(COMMENT_MARKER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated ContextLevy comment (${existing.id}).`);
    return;
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
  const tokenInput = core.getInput('github-token');
  const token = tokenInput || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('github-token input is required when GITHUB_TOKEN is not set.');
  }
  const tokenThreshold = Number(core.getInput('token-threshold') || '1000');
  const largeFileTokenThreshold = Number(
    core.getInput('large-file-token-threshold') || '5000',
  );
  const maxHighImpactItems = Number(core.getInput('max-high-impact-items') || '5');
  const showCostTable = parseBooleanInput(core.getInput('show-cost-table') || 'true', true);
  const pricingProfilesInput =
    core.getInput('pricing-profiles') || core.getInput('model-pricing') || '';
  const pricingProfiles = parsePricingProfiles(pricingProfilesInput);

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not a pull_request event — skipping.');
    return;
  }

  const pullNumber = context.payload.pull_request.number;
  const { owner, repo } = context.repo;

  core.info(`Analyzing PR #${pullNumber} in ${owner}/${repo}`);

  const files = await listAllPullRequestFiles(octokit, owner, repo, pullNumber);
  const analysis = analyzePullRequestFiles(files, { largeFileTokenThreshold });

  core.setOutput('total-estimated-tokens', String(analysis.totalEstimatedTokens));
  core.setOutput('analyzed-file-count', String(analysis.files.length));

  if (analysis.totalEstimatedTokens < tokenThreshold) {
    core.info(
      `Estimated tokens (${analysis.totalEstimatedTokens}) below threshold (${tokenThreshold}) — no comment posted.`,
    );
    return;
  }

  const body = formatComment(analysis, {
    maxHighImpactItems,
    showCostTable,
    pricingProfiles,
  });

  await upsertComment(octokit, owner, repo, pullNumber, body);
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
