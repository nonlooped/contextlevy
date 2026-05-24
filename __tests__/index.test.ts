import { describe, expect, it, vi } from 'vitest';
import { upsertComment } from '../src/index';

function createAccessError(): Error & { status: number } {
  const error = new Error('Resource not accessible by integration') as Error & { status: number };
  error.status = 403;
  return error;
}

describe('upsertComment', () => {
  it('returns false when the token cannot write comments', async () => {
    const octokit = {
      paginate: {
        iterator: vi.fn(async function* () {
          yield { data: [] };
        }),
      },
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn(async () => {
            throw createAccessError();
          }),
          updateComment: vi.fn(),
        },
      },
    };

    await expect(
      upsertComment(octokit as never, 'owner', 'repo', 123, 'body'),
    ).resolves.toBe(false);
  });

  it('only updates comments authored by the current action identity', async () => {
    const octokit = {
      paginate: {
        iterator: vi.fn(async function* () {
          yield {
            data: [
              {
                id: 1,
                body: '<!-- contextlevy --> copied marker',
                user: { login: 'other-bot[bot]', type: 'Bot' },
              },
              {
                id: 2,
                body: '<!-- contextlevy --> owned marker',
                user: { login: 'github-actions[bot]', type: 'Bot' },
              },
            ],
          };
        }),
      },
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn(),
          updateComment: vi.fn(async () => undefined),
        },
      },
    };

    await expect(
      upsertComment(octokit as never, 'owner', 'repo', 123, 'body', {
        botLogin: 'github-actions[bot]',
      }),
    ).resolves.toBe(true);

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 2 }),
    );
  });
});
