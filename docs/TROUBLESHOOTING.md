# Troubleshooting

## `Resource not accessible by integration`

Your workflow token or GitHub App probably does not have enough permissions to create or update PR comments.

Check:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

If you use the GitHub App, confirm the installation has:

* Contents: read
* Pull requests: read & write
* Issues: read & write

For pull requests from forks, GitHub may still provide a read-only workflow token. In that case ContextLevy logs a warning, keeps the action successful, still exposes analysis outputs, and writes a job summary — but may not post a PR comment.

Install the GitHub App when your organization policy allows it for more reliable fork PR comments.

## Fork pull requests

See [SECURITY.md — Fork pull requests](../SECURITY.md#fork-pull-requests) for permission details. See also [ACTION.md — Fork pull requests](ACTION.md#fork-pull-requests).

## `CONTEXTLEVY_APP_PRIVATE_KEY` is invalid

Make sure the secret contains the GitHub App private key PEM.

It should look like this:

```txt
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

Do not use the app Client Secret.

## The comment did not appear

ContextLevy skips comments below `token-threshold`. Fail mode (`fail-on-severity`, `fail-above-tokens`) still runs in that case — a skipped comment does not mean the check was skipped.

Lower the threshold while testing:

```yaml
token-threshold: 0
```

## The estimate looks too high

That usually means the PR added large generated files, coverage output, build artifacts, or lockfile churn.

If the files are intentional, either ignore the warning or raise your thresholds. See [CONFIG.md](CONFIG.md) for threshold and ignore-path options.
