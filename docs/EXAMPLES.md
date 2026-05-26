# ContextLevy examples

Realistic configuration and output patterns for common repository setups.

## Before / after

**Before ContextLevy:** A PR silently adds ~90k tokens of coverage output, generated clients, and build artifacts. Reviewers see a green CI check and merge.

**After ContextLevy:** The PR comment names the exact files, estimated token cost, severity, and cleanup suggestions before the noise becomes repo debt.

![ContextLevy PR comment example](../.github/assets/PR-Example.png)

## Benchmark table (illustrative)

These numbers use the default `simple` estimation mode (`ceil(chars / 4)`) on typical added diffs. Actual counts vary by tokenizer and whether GitHub returns full patches.

| Artifact type | Example path | Typical added tokens | Category |
| --- | --- | ---: | --- |
| Coverage report | `coverage/lcov.info` | 20k–80k+ | `coverage` |
| Generated GraphQL client | `src/generated/client.ts` | 5k–40k | `generated` |
| Lockfile churn | `pnpm-lock.yaml` | 2k–30k | `lockfile` |
| Source map | `dist/app.js.map` | 10k–100k+ | `source-map` |
| Playwright report | `playwright-report/index.html` | 5k–25k | `test-output` |
| Agent instructions | `.agents/skills/foo/SKILL.md` | 500–5k | `agent-config` |

Switch to `estimation-mode: tokenizer` for BPE-based counts closer to GPT-family models.

## Monorepo with generated output

```yaml
token-threshold: 2000
comment-format: compact

ignore-paths:
  - "**/*.snap"

custom-rules:
  - name: generated-supabase-types
    paths:
      - "packages/db/src/generated/**"
      - "supabase/types.ts"
    category: generated
    label: Generated Supabase types are usually low-value agent context.
    suggestion: Regenerate locally unless this repo intentionally tracks generated DB types.

fail-on-severity: high
```

## Internal team with custom pricing

```yaml
show-cost-table: true
pricing-profiles:
  - name: Internal Gateway
    inputCostPerMillion: 1.25
  - name: Local 70B
    inputCostPerMillion: 0.05

severity-thresholds:
  medium-tokens: 3000
  high-tokens: 15000
  critical-tokens: 75000
```

## Precise token estimation

```yaml
estimation-mode: tokenizer
token-threshold: 500
```

Uses the local `cl100k_base` BPE tokenizer (no network calls). Helpful for lockfiles, JSON, and generated code where `chars / 4` is noisy.

## Using action outputs in downstream steps

```yaml
jobs:
  contextlevy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: contextlevy
        uses: nonlooped/contextlevy@v2

      - name: Gate deploy on context cost
        if: ${{ steps.contextlevy.outputs.total-estimated-tokens > 50000 }}
        run: echo "Context cost too high for auto-deploy"
```

| Output | Type | Example |
| --- | --- | --- |
| `total-estimated-tokens` | integer string | `"37891"` |
| `analyzed-file-count` | integer string | `"12"` |
| `token-source` | string | `"app"` |
| `estimation-mode` | string | `"simple"` or `"tokenizer"` |

## Fork pull requests

For PRs from forks, GitHub often provides a read-only `GITHUB_TOKEN`. ContextLevy still analyzes the diff and writes a job summary, but may not be able to create or update PR comments. Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) for reliable comment posting on fork PRs when permitted by your org policy.

## JSON Schema autocomplete

Point your editor at [`docs/schema/contextlevy.schema.json`](schema/contextlevy.schema.json):

```yaml
# yaml-language-server: $schema=./docs/schema/contextlevy.schema.json
token-threshold: 1000
```
