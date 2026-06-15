# Quick start

ContextLevy is a **repo hygiene linter for agent-heavy teams**. It flags PR diffs that will make coding-agent review noisy — generated output, coverage, build artifacts, lockfile churn, and agent instruction changes.

## 60 seconds

```bash
# 1. Baseline repo context debt (tracked files)
npx contextlevy scan

# 2. Scan your current diff (no install required)
npx contextlevy check --base main

# 3. Add config when you're ready
npx contextlevy init

# 4. Optional: config + workflow + pre-push hook in one step
npx contextlevy init --full
```

## Modes (one knob)

Add `mode` to `contextlevy.config.yml`:

| Mode | Best for |
| --- | --- |
| `advisory` (default) | Compact PR comments, hygiene alerts, no merge blocking |
| `strict` | Fail CI when committed junk (`dist/`, `coverage/`, `node_modules/`, etc.) |
| `minimal` | Only comment on High/Critical severity |
| `legacy` | v2.3 behavior (default comments, cost table on, token-only comment gate) |

Example:

```yaml
mode: advisory
```

Explicit config keys always override preset values.

## Intentional generated files

If your repo **should** commit generated output, allowlist it:

```yaml
allow-paths:
  - "packages/api/src/generated/**"
```

Files on the allowlist are still counted but not flagged as high-impact, including `large-file` promotion when diffs exceed `large-file-token-threshold`.

## Strict local check

```bash
npx contextlevy check --base main --strict
```

`--strict` applies category-based fails (build artifacts, coverage, etc.) without editing config.

## Pre-push hook

```bash
npx contextlevy hook install
```

Or wire manually in `package.json`:

```json
{
  "scripts": {
    "contextlevy": "contextlevy check --base origin/main --fail-on-config"
  }
}
```

Use `mode: strict` in config when you want hard gates in CI and hooks.

## Next steps

- [CONFIG.md](CONFIG.md) — all options and advanced tuning
- [CLI.md](CLI.md) — flags, JSON output, exit codes
- [ACTION.md](ACTION.md) — GitHub Action setup
