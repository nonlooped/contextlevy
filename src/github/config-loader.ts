import type * as github from '@actions/github';
import { loadConfigFromRepository } from '../config/load';

function isRepositoryContentNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: number }).status === 404
  );
}

export async function loadBaseConfig(
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

      return Buffer.from(response.data.content, response.data.encoding as BufferEncoding).toString(
        'utf8',
      );
    } catch (error) {
      if (isRepositoryContentNotFound(error)) {
        return null;
      }
      throw error;
    }
  }, ref);
}
