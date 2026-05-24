import * as core from '@actions/core';
import * as github from '@actions/github';
import { resolveGithubToken } from './auth';
import { analyzePullRequestFiles } from './analyze';
import { COMMENT_MARKER, formatComment } from './comment';
import { shouldFailRun } from './fail';
import { loadConfigFile, loadConfigFromRepository, type ContextLevyConfig } from './config';
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

interface UpsertCommentOptions {
  botLogin?: string;
}

function isRepositoryContentNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: number }).status === 404
  );
}

async function loadBaseConfig(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  ref: string,
) {
  return loadConfigFromRepository(async (path, candidateRef) => {
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: candidateRef,
      });

      if (
        Array.isArray(response.data) ||
        response.data.type !== 'file' ||
        !('content' in response.data)
      ) {
        return null;
      }

      return Buffer.from(
        response.data.content,
        response.data.encoding as BufferEncoding,
      ).toString('utf8');
    } catch (error) {
      if (isRepositoryContentNotFound(error)) {
        return null;
      }
      throw error;
    }
  }, ref);
}

async function findContextLevyComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  options: UpsertCommentOptions = {},
): Promise<{ id: number } | undefined> {
  for await (const response of octokit.paginate.iterator(
    octokit.rest.issues.listComments,
    {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    },
  )) {
    for (const comment of response.data) {
      const isExpectedAuthor = options.botLogin ? comment.user?.login === options.botLogin : true;
      if (isExpectedAuthor && comment.body?.includes(COMMENT_MARKER)) {
        return { id: comment.id };
      }
    }
  }

  return undefined;
}

export async function upsertComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  options: UpsertCommentOptions = {},
): Promise<boolean> {
  const existing = await findContextLevyComment(octokit, owner, repo, issueNumber, options);

  if (existing) {
    try {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
      core.info(`Updated ContextLevy comment (${existing.id}).`);
      return true;
    } catch (error) {
      if (!isCommentAccessError(error)) {
        throw error;
      }

      core.info(
        `Cannot update existing ContextLevy comment (${existing.id}) with the current token; creating a new comment.`,
      );
    }
  }

  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    core.info('Created ContextLevy comment.');
    return true;
  } catch (error) {
    if (!isCommentAccessError(error)) {
      throw error;
    }

    core.warning(
      'ContextLevy could not create a PR comment with the current token. Analysis outputs were still set.',
    );
    return false;
  }
}

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
  });

  core.setOutput('total-estimated-tokens', String(analysis.totalEstimatedTokens));
  core.setOutput('analyzed-file-count', String(analysis.files.length));

  const failDecision = shouldFailRun(
    analysis,
    {
      failOnSeverity: settings.failOnSeverity,
      failAboveTokens: settings.failAboveTokens,
    },
    settings.maxHighImpactItems,
  );

  if (failDecision.fail) {
    core.setFailed(failDecision.reason ?? 'ContextLevy fail threshold exceeded.');
  }

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

if (require.main === module) {
  run().catch((error: unknown) => {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  });
}
