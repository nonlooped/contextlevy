import * as core from '@actions/core';
import type * as github from '@actions/github';
import { COMMENT_MARKER } from '../format/comment';

export function isCommentAccessError(error: unknown): boolean {
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

async function findContextLevyComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  options: UpsertCommentOptions = {},
): Promise<{ id: number } | undefined> {
  for await (const response of octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  })) {
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
