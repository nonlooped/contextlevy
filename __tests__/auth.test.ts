import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import {
  createAppInstallationToken,
  normalizePrivateKey,
  readAppCredentials,
  resolveGithubToken,
} from '../src/auth';

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(() =>
    vi.fn(async () => ({
      token: 'app-installation-token',
    })),
  ),
}));

describe('normalizePrivateKey', () => {
  it('restores escaped newlines from GitHub secrets', () => {
    expect(normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----')).toBe(
      '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
    );
  });
});

describe('readAppCredentials', () => {
  beforeEach(() => {
    vi.spyOn(core, 'getInput').mockReturnValue('');
    delete process.env.CONTEXTLEVY_APP_CLIENT_ID;
    delete process.env.CONTEXTLEVY_APP_PRIVATE_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when app credentials are absent', () => {
    expect(readAppCredentials()).toBeNull();
  });

  it('reads credentials from environment variables', () => {
    process.env.CONTEXTLEVY_APP_CLIENT_ID = '123456';
    process.env.CONTEXTLEVY_APP_PRIVATE_KEY = 'test-key';

    expect(readAppCredentials()).toEqual({
      appId: '123456',
      privateKey: 'test-key',
    });
  });

  it('requires both app id and private key when partially configured', () => {
    process.env.CONTEXTLEVY_APP_CLIENT_ID = '123456';

    expect(() => readAppCredentials()).toThrow(/requires both/i);
  });
});

describe('createAppInstallationToken', () => {
  it('creates an installation token for the current repository', async () => {
    const token = await createAppInstallationToken(
      { appId: '123456', privateKey: 'test-key' },
      'unloopedmido',
      'contextlevy',
    );

    expect(token).toBe('app-installation-token');
  });
});

describe('resolveGithubToken', () => {
  beforeEach(() => {
    vi.spyOn(core, 'getInput').mockReturnValue('');
    delete process.env.CONTEXTLEVY_APP_CLIENT_ID;
    delete process.env.CONTEXTLEVY_APP_PRIVATE_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers GitHub App credentials when configured', async () => {
    process.env.CONTEXTLEVY_APP_CLIENT_ID = '123456';
    process.env.CONTEXTLEVY_APP_PRIVATE_KEY = 'test-key';

    const resolved = await resolveGithubToken('unloopedmido', 'contextlevy');

    expect(resolved.source).toBe('app');
    expect(resolved.token).toBe('app-installation-token');
  });

  it('falls back to github-token input', async () => {
    vi.spyOn(core, 'getInput').mockImplementation((name: string) =>
      name === 'github-token' ? 'input-token' : '',
    );

    const resolved = await resolveGithubToken('unloopedmido', 'contextlevy');

    expect(resolved.source).toBe('github-token');
    expect(resolved.token).toBe('input-token');
  });

  it('falls back to GITHUB_TOKEN', async () => {
    process.env.GITHUB_TOKEN = 'env-token';

    const resolved = await resolveGithubToken('unloopedmido', 'contextlevy');

    expect(resolved.source).toBe('GITHUB_TOKEN');
    expect(resolved.token).toBe('env-token');
  });
});
