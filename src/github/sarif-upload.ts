import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import * as core from '@actions/core';
import type * as github from '@actions/github';
import type { PullRequestAnalysis } from '../core/types';
import { buildSarifReport } from '../format/sarif';

export function writeSarifFile(
  analysis: PullRequestAnalysis,
  outputPath: string,
): Record<string, unknown> {
  const sarif = buildSarifReport(analysis);
  writeFileSync(outputPath, `${JSON.stringify(sarif, null, 2)}\n`, 'utf8');
  return sarif;
}

export function isSarifUploadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { status?: number; message?: string };
  return (
    candidate.status === 403 ||
    candidate.status === 404 ||
    candidate.status === 422 ||
    Boolean(candidate.message?.includes('Resource not accessible by integration')) ||
    Boolean(candidate.message?.includes('Code scanning is not enabled'))
  );
}

export async function uploadSarifReport(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  headSha: string,
  ref: string,
  analysis: PullRequestAnalysis,
  workspaceRoot: string,
): Promise<{ uploaded: boolean; sarifPath: string }> {
  const sarifPath = join(workspaceRoot, 'contextlevy-results.sarif.json');
  const sarif = writeSarifFile(analysis, sarifPath);

  const compressed = gzipSync(Buffer.from(JSON.stringify(sarif), 'utf8'));

  try {
    await octokit.rest.codeScanning.uploadSarif({
      owner,
      repo,
      commit_sha: headSha,
      ref,
      sarif: compressed.toString('base64'),
    });
    core.info(`Uploaded SARIF report for ${ref} (${headSha}).`);
    return { uploaded: true, sarifPath };
  } catch (error) {
    if (isSarifUploadError(error)) {
      core.warning(
        `ContextLevy could not upload SARIF to Code Scanning (${error instanceof Error ? error.message : String(error)}). SARIF was still written to ${sarifPath}. Add security-events: write permission.`,
      );
      return { uploaded: false, sarifPath };
    }
    throw error;
  }
}
