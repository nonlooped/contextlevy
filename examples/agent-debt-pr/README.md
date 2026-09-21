# Agent-debt PR examples

These files are **intentional fixtures** for dogfooding ContextLevy on pull requests. They mimic paths that inflate AI agent context cost without the coverage/generated patterns in `high-impact-pr/`:

- `pnpm-lock.yaml` — lockfile churn
- `dist/app.js` — build output
- `.agents/skills/onboarding/SKILL.md` — agent instruction files

Do not copy these into production repos. They exist so ContextLevy can demonstrate classification of lockfiles, build artifacts, and agent config on real GitHub pull requests.
