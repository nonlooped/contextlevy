import * as core from '@actions/core';
import { run } from './github/run';

export { upsertComment } from './github/comments';
export { run } from './github/run';

if (require.main === module) {
  run().catch((error: unknown) => {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  });
}
