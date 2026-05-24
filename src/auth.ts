import * as core from '@actions/core';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

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
  let key = privateKey.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\n/g, '\n');

  const beginMarker = key.match(/-----BEGIN [^-]+-----/)?.[0];
  const endMarker = key.match(/-----END [^-]+-----/)?.[0];

  if (beginMarker && endMarker && !key.includes('\n')) {
    const body = key.slice(beginMarker.length, key.indexOf(endMarker)).replace(/\s/g, '');
    const wrappedBody = body.match(/.{1,64}/g) ?? [body];
    key = [beginMarker, ...wrappedBody, endMarker].join('\n');
  }

  if (beginMarker && !key.endsWith('\n')) {
    key += '\n';
  }

  return key;
}

export function readAppCredentials(): AppCredentials | null {
  const appId =
    core.getInput('app-client-id').trim() ||
    process.env.CONTEXTLEVY_APP_ID?.trim() ||
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

export function assertValidAppId(appId: string): void {
  if (/^Iv/i.test(appId)) {
    throw new Error(
      'CONTEXTLEVY_APP_CLIENT_ID looks like a GitHub OAuth Client ID (Iv...). ' +
        'Use the numeric GitHub App ID from your app settings instead, or set CONTEXTLEVY_APP_ID.',
    );
  }
}

export async function createAppInstallationToken(
  credentials: AppCredentials,
  owner: string,
  repo: string,
): Promise<string> {
  assertValidAppId(credentials.appId);

  const auth = createAppAuth({
    appId: credentials.appId,
    privateKey: credentials.privateKey,
  });

  const installationIdInput =
    core.getInput('app-installation-id').trim() ||
    process.env.CONTEXTLEVY_APP_INSTALLATION_ID?.trim() ||
    '';

  let installationId = installationIdInput ? Number(installationIdInput) : undefined;

  if (!installationId || Number.isNaN(installationId)) {
    const appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: credentials.appId,
        privateKey: credentials.privateKey,
      },
    });

    const { data: installation } = await appOctokit.rest.apps.getRepoInstallation({
      owner,
      repo,
    });
    installationId = installation.id;
  }

  const { token } = await auth({
    type: 'installation',
    installationId,
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
    try {
      return {
        token: await createAppInstallationToken(appCredentials, owner, repo),
        source: 'app',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tokenInput = core.getInput('github-token');
      const envToken = process.env.GITHUB_TOKEN;
      const fallbackToken = tokenInput || envToken;

      if (fallbackToken) {
        core.warning(
          `ContextLevy GitHub App auth failed (${message}). Falling back to ${tokenInput ? 'github-token' : 'GITHUB_TOKEN'}.`,
        );
        return {
          token: fallbackToken,
          source: tokenInput ? 'github-token' : 'GITHUB_TOKEN',
        };
      }

      throw new Error(
        `ContextLevy GitHub App auth failed (${message}), and no github-token / GITHUB_TOKEN fallback was available. ` +
          'Ensure CONTEXTLEVY_APP_PRIVATE_KEY contains the full PEM private key from your GitHub App.',
      );
    }
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
