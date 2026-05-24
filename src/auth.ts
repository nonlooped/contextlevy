import * as core from '@actions/core';
import { createAppAuth } from '@octokit/auth-app';

export type TokenSource = 'app' | 'github-token' | 'GITHUB_TOKEN';

export interface AppCredentials {
  appId: string;
  privateKey: string;
}

export interface ResolvedGithubToken {
  token: string;
  source: TokenSource;
}

export function normalizePrivateKey(privateKey: string): string {
  if (privateKey.includes('\\n')) {
    return privateKey.replace(/\\n/g, '\n');
  }
  return privateKey;
}

export function readAppCredentials(): AppCredentials | null {
  const appId =
    core.getInput('app-client-id').trim() ||
    process.env.CONTEXTLEVY_APP_CLIENT_ID?.trim() ||
    '';
  const privateKeyRaw =
    core.getInput('app-private-key').trim() ||
    process.env.CONTEXTLEVY_APP_PRIVATE_KEY?.trim() ||
    '';

  if (!appId && !privateKeyRaw) {
    return null;
  }

  if (!appId || !privateKeyRaw) {
    throw new Error(
      'GitHub App auth requires both CONTEXTLEVY_APP_CLIENT_ID and CONTEXTLEVY_APP_PRIVATE_KEY.',
    );
  }

  return {
    appId,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

export async function createAppInstallationToken(
  credentials: AppCredentials,
  owner: string,
  repo: string,
): Promise<string> {
  const auth = createAppAuth({
    appId: credentials.appId,
    privateKey: credentials.privateKey,
  });

  const { token } = await auth({
    type: 'installation',
    owner,
    repo,
  });

  if (!token) {
    throw new Error('Failed to create GitHub App installation token.');
  }

  return token;
}

export async function resolveGithubToken(
  owner: string,
  repo: string,
): Promise<ResolvedGithubToken> {
  const appCredentials = readAppCredentials();
  if (appCredentials) {
    core.info('Using ContextLevy GitHub App installation token.');
    return {
      token: await createAppInstallationToken(appCredentials, owner, repo),
      source: 'app',
    };
  }

  const tokenInput = core.getInput('github-token');
  if (tokenInput) {
    core.info('Using github-token input.');
    return { token: tokenInput, source: 'github-token' };
  }

  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    core.info('Using GITHUB_TOKEN.');
    return { token: envToken, source: 'GITHUB_TOKEN' };
  }

  throw new Error(
    'No GitHub credentials found. Configure the ContextLevy GitHub App or provide github-token / GITHUB_TOKEN.',
  );
}
