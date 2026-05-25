# Configuration

ContextLevy reads all analysis and comment options from a config file in the repository. Add a config file once — workflow YAML stays minimal.

On pull requests, ContextLevy reads configuration from the base branch version of the repository. A PR cannot silence the check by changing `contextlevy.config.yml` in the same diff.

## Config paths

Supported config paths, in priority order:

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

If no config file is found, ContextLevy uses built-in defaults.

## JSON Schema

Enable editor autocomplete with the published JSON Schema:

```yaml
# yaml-language-server: $schema=./docs/schema/contextlevy.schema.json
token-threshold: 1000
```

Schema file: [docs/schema/contextlevy.schema.json](schema/contextlevy.schema.json)

## Example `contextlevy.config.yml`

```yaml
token-threshold: 1000
large-file-token-threshold: 5000
max-high-impact-items: 5
show-cost-table: true
comment-format: default

ignore-paths:
  - vendor/**
  - "**/*.map"

fail-on-severity: high

custom-rules:
  - name: generated-supabase-types
    paths:
      - "supabase/types.ts"
      - "src/database/generated/**"
    category: generated
    label: Generated Supabase types are usually low-value agent context.
    suggestion: Regenerate locally unless this repo intentionally tracks generated DB types.

estimation-mode: simple

severity-thresholds:
  medium-tokens: 5000
  high-tokens: 20000
  critical-tokens: 100000

pricing-profiles:
  - name: GPT-5.5
    inputCostPerMillion: 5.0
  - name: Opus 4.7
    inputCostPerMillion: 5.0
  - name: Team Gateway
    inputCostPerMillion: 1.75
```

Keys support both kebab-case and camelCase:

```yaml
token-threshold: 1000
```

```yaml
tokenThreshold: 1000
```

## Config options

| Key | Default | Description |
| --- | --- | --- |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Mark individual files as large context risks |
| `max-high-impact-items` | `5` | Max files shown in the high-impact table |
| `show-cost-table` | `true` | Include estimated model input costs |
| `comment-format` | `default` | `default` or `compact` |
| `ignore-paths` | `[]` | Glob patterns excluded from analysis entirely |
| `allow-paths` | `[]` | Glob patterns counted but not flagged as high-impact |
| `fail-on-severity` | unset | Fail workflow at `low` / `medium` / `high` / `critical` or above |
| `fail-above-tokens` | unset | Fail workflow when estimated tokens exceed this value |
| `estimation-mode` | `simple` | `simple` (`ceil(chars / 4)`) or `tokenizer` (local BPE, no network) |
| `custom-rules` | `[]` | Project-specific path rules (see example above) |
| `severity-thresholds` | built-in defaults | Override token/high-impact counts for Low/Medium/High/Critical |
| `pricing-profiles` | built-in defaults | Array of `{ name, inputCostPerMillion }` objects |

When `fail-on-severity` or `fail-above-tokens` is set, ContextLevy fails the workflow if thresholds are exceeded. **Fail mode runs even when the PR comment is skipped** — for example, when estimated tokens are below `token-threshold`. Analysis and fail checks always run; `token-threshold` only controls whether a comment is posted.

## Severity levels

| Severity   | Meaning                                          |
| ---------- | ------------------------------------------------ |
| `Low`      | Small context increase, usually safe             |
| `Medium`   | Worth reviewing, especially in agent-heavy repos |
| `High`     | Likely to affect AI coding sessions              |
| `Critical` | Very large diff or obvious repo-noise artifact   |

Override thresholds in config:

```yaml
severity-thresholds:
  medium-tokens: 5000
  high-tokens: 20000
  critical-tokens: 100000
  medium-high-impact-count: 1
  high-high-impact-count: 3
  critical-high-impact-count: 8
```

## Common recipes

### Only comment on large context changes

```yaml
token-threshold: 5000
```

### Show fewer files in the PR comment

```yaml
max-high-impact-items: 3
```

### Use compact comments

```yaml
comment-format: compact
```

### Use BPE tokenizer estimation

```yaml
estimation-mode: tokenizer
```

### Define project-specific rules

```yaml
custom-rules:
  - paths:
      - "packages/api/src/generated/**"
    category: generated
    label: Generated API clients add repetitive agent context.
    suggestion: Regenerate locally during development.
```

### Disable model cost estimates

```yaml
show-cost-table: false
```

### Use your own model pricing

```yaml
pricing-profiles:
  - name: Internal Gateway
    inputCostPerMillion: 1.25
  - name: Local Inference
    inputCostPerMillion: 0.05
```

## Good files to ignore

ContextLevy is most useful when paired with normal repository hygiene.

Common `.gitignore` additions:

```gitignore
coverage/
htmlcov/
dist/
build/
.next/
.cache/
*.log
```

Generated files may still belong in version control depending on your language, package manager, or deployment setup. ContextLevy does not block PRs by default; it gives reviewers a focused warning.

## Comment formats

### Default

Best for most repositories.

Includes:

* severity
* estimated token delta
* high-impact files
* file classifications
* optional cost table
* cleanup suggestions

```yaml
comment-format: default
```

### Compact

Best for busy repos that want a smaller PR footprint.

Usually 3–4 lines:

```yaml
comment-format: compact
```

Example:

```txt
🤖 ContextLevy · ⚠️ High · ~42.1k tokens
+31.4k coverage/lcov.info · +8.2k dist/index.js · +2.5k generated/client.ts
~$0.02–$0.12/session est. input · Add coverage/ and dist/ to .gitignore
```

## Default pricing profiles

Default pricing profiles are **illustrative** and may drift as model prices change. For accurate internal estimates, configure your own `pricing-profiles`.

When `pricing-profiles` is omitted, ContextLevy estimates worst-case input cost using:

| Profile        | Input cost / 1M tokens |
| -------------- | ---------------------: |
| GPT-5.5        |                `$5.00` |
| Opus 4.7       |                `$5.00` |
| Gemini 3.1 Pro |                `$2.00` |
| Kimi K2.6      |                `$0.95` |

Hide the cost table in your config file:

```yaml
show-cost-table: false
```

Override pricing profiles:

```yaml
pricing-profiles:
  - name: Local 70B
    inputCostPerMillion: 0.2
  - name: Team Gateway
    inputCostPerMillion: 1.75
```

## Estimation modes

ContextLevy supports two local estimation modes (no LLM calls, no network):

| Mode | Method | Best for |
| --- | --- | --- |
| `simple` (default) | `ceil(chars / 4)` on added diff lines | Fast warnings, CI everywhere |
| `tokenizer` | `cl100k_base` BPE token count on added diff text | Closer to GPT-family token counts |

## How estimation works

Process:

1. List files changed in the pull request.
2. Read added diff lines from each patch.
3. Estimate tokens using the configured mode.
4. If no patch is available, fall back to `additions × 10`.
5. Classify risky paths with built-in rules plus optional `custom-rules`.

This is intentionally approximate.

Different models tokenize differently, agents may not read every changed file, and cached-token pricing varies by provider. Cost tables show ±50% ranges. Treat the output as a practical warning signal, not an invoice.
