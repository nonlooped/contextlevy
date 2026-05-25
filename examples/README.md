# ContextLevy examples

Intentional fixtures for dogfooding ContextLevy on real GitHub pull requests. Do not copy these into production repos.

| Example | Paths | Categories demonstrated |
| --- | --- | --- |
| [high-impact-pr](high-impact-pr/) | `coverage/lcov.info`, `prisma/generated/client.ts` | coverage, generated |
| [agent-debt-pr](agent-debt-pr/) | `pnpm-lock.yaml`, `dist/app.js`, `.agents/skills/onboarding/SKILL.md` | lockfile, build output, agent config |

## Live demo pull request

ContextLevy runs on every pull request in this repository. To see a **live PR comment** with real workflow output, open the intentionally kept demo PR:

**[Live demo PR](https://github.com/unloopedmido/contextlevy/pull/PLACEHOLDER)** — `examples/live-demo` → `main` (do not merge)

That PR adds the `agent-debt-pr` fixtures so visitors can inspect the ContextLevy check, job summary, and PR comment without installing anything.

Maintainers: keep this PR open. When `main` moves ahead, rebase `examples/live-demo` and push so the demo stays current.
