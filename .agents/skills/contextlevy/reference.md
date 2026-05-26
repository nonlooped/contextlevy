# ContextLevy reference

## Config file paths (priority order)

1. `contextlevy.config.yml`
2. `contextlevy.config.yaml`
3. `contextlevy.config.json`
4. `.github/contextlevy.config.yml`
5. `.github/contextlevy.config.yaml`
6. `.github/contextlevy.config.json`
7. `.contextlevy.yml` (legacy)
8. `.contextlevy.yaml` (legacy)
9. `.contextlevy.json` (legacy)
10. `.github/contextlevy.yml` (legacy)
11. `.github/contextlevy.yaml` (legacy)
12. `.github/contextlevy.json` (legacy)
13. `contextlevy.yml` (legacy)
14. `contextlevy.yaml` (legacy)
15. `contextlevy.json` (legacy)

Keys accept kebab-case or camelCase (`token-threshold` / `tokenThreshold`).

## Full config options

| Key | Default | Description |
| --- | --- | --- |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Mark individual files as large context risks |
| `max-high-impact-items` | `5` | Max files shown in the high-impact table |
| `show-cost-table` | `true` | Include estimated model input costs |
| `comment-format` | `default` | `default` or `compact` |
| `ignore-paths` | `[]` | Glob patterns excluded from analysis |
| `allow-paths` | `[]` | Glob patterns counted but not flagged as high-impact |
| `fail-on-severity` | unset | Fail at `low` / `medium` / `high` / `critical` or above |
| `fail-above-tokens` | unset | Fail when estimated tokens exceed this value |
| `estimation-mode` | `simple` | `simple` or `tokenizer` |
| `custom-rules` | `[]` | Project-specific path rules (see below) |
| `severity-thresholds` | built-in | Override token/high-impact counts per risk level |
| `pricing-profiles` | built-in | `{ name, inputCostPerMillion }` for cost table |

## Custom rules example

```yaml
custom-rules:
  - name: generated-supabase-types
    paths:
      - supabase/types.ts
      - src/database/generated/**
    category: generated
    label: Generated Supabase types are usually low-value agent context.
    suggestion: Regenerate locally unless this repo tracks generated DB types.
```

Supported categories: `generated`, `coverage`, `lockfile`, `build-output`, `log`, `snapshot`, `agent-config`, `minified`, `vendor`, `source-map`, `protobuf`, `openapi`, `dependency-dir`, `cache-dir`, `test-output`, `fixture`, `binary-asset`, `large-file`, `other`.

## Severity thresholds (defaults)

| Level | Token threshold | High-impact file count |
| --- | ---: | ---: |
| Medium | 5,000 | 1 |
| High | 20,000 | 3 |
| Critical | 100,000 | 8 |

Override with `severity-thresholds` in config.

## Estimation modes

| Mode | Behavior |
| --- | --- |
| `simple` | `ceil(added_chars / 4)` from diff patches |
| `tokenizer` | Local BPE (`cl100k_base`) — closer to provider tokenizers, still an estimate |

## Action auth inputs

| Input | Fallback env |
| --- | --- |
| `github-token` | `GITHUB_TOKEN` |
| `app-client-id` | `CONTEXTLEVY_APP_ID` / `CONTEXTLEVY_APP_CLIENT_ID` |
| `app-private-key` | `CONTEXTLEVY_APP_PRIVATE_KEY` |
| `app-installation-id` | `CONTEXTLEVY_APP_INSTALLATION_ID` |

Prefer the published GitHub App over self-hosted app credentials.

## Common recipes

**Strict CI gate**

```yaml
fail-above-tokens: 20000
fail-on-severity: high
```

**Advisory comments only**

```yaml
token-threshold: 1000
# omit fail-on-severity and fail-above-tokens
```

**Ignore monorepo vendored trees**

```yaml
ignore-paths:
  - "**/node_modules/**"
  - vendor/**
  - "**/*.map"
```

**Compact PR comments**

```yaml
comment-format: compact
max-high-impact-items: 3
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| CLI shows 0 tokens for new files | `git add` the files or use `--staged` |
| Action skips comment | Tokens below `token-threshold` — fail mode may still run |
| Fork PR has no write access | Expected for `GITHUB_TOKEN`; use GitHub App for fork PRs |
| Estimate seems high | Usually coverage, generated clients, or lockfile churn — check high-impact table |

## Links

- Repository: https://github.com/nonlooped/contextlevy
- GitHub App: https://github.com/apps/contextlevy
- npm CLI: `npm install -g contextlevy`
- JSON Schema: `docs/schema/contextlevy.schema.json` in the repo
