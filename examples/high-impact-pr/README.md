# High-impact PR examples

These files are **intentional fixtures** for dogfooding ContextLevy on pull requests. They mimic paths that usually inflate AI agent context cost:

- `coverage/lcov.info` — coverage output
- `prisma/generated/client.ts` — generated code

PR comments also highlight **agent instruction changes** (`.cursorrules`, `AGENTS.md`, `.agents/`) even when token counts are small.

Do not copy these into production repos. They exist so the ContextLevy action can demonstrate its PR comment on real GitHub pull requests.
