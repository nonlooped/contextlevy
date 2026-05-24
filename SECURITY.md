# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.1.x   | Yes       |
| 2.0.x   | Yes       |
| < 2.0   | No        |

Security fixes are released as patch versions on the latest minor release line.

## Reporting a vulnerability

Please report security issues privately through [GitHub Security Advisories](https://github.com/unloopedmido/contextlevy/security/advisories/new).

Do not open public issues for suspected token handling, GitHub App permission, workflow, or comment injection vulnerabilities.

Include:

- Affected version or tag
- Steps to reproduce
- Expected vs actual behavior
- Impact assessment if known

## Minimum permissions

### GitHub App (recommended)

| Permission    | Access       |
| ------------- | ------------ |
| Contents      | Read         |
| Pull requests | Read & write |
| Issues        | Read & write |

### Workflow token-only mode

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

Grant only what ContextLevy needs. It reads PR diffs and writes PR comments — it does not need `contents: write`.

## Fork pull requests

Pull requests from forks often receive a read-only `GITHUB_TOKEN`. ContextLevy still analyzes diffs and writes a job summary, but comment creation may fail with `Resource not accessible by integration`. The workflow remains successful unless you enable fail mode.

For fork PRs, install the ContextLevy GitHub App when your organization policy allows it.

## Supply chain

- Pin the action to a major tag (`@v2`) or full commit SHA for high-security environments.
- Release artifacts are built in CI from tagged commits; see `.github/workflows/release.yml`.
- Report supply-chain concerns through Security Advisories.
