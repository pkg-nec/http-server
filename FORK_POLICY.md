# Fork Policy

This document explains how `pkg-nec/http-server` is maintained as a fork of [`http-party/http-server`](https://github.com/http-party/http-server).

## What this fork is

`@pkg-nec/http-server` is a **security-patch-only maintained fork** of `http-server`, which has been effectively unmaintained since early 2022. The upstream repository still exists but no longer receives dependency updates or vulnerability patches.

The goal of this fork is to keep the package safe to use as a drop-in replacement, without introducing new features or breaking changes.

## What we merge from upstream

We monitor the upstream repository and merge:

- **Security fixes** — patches for CVEs or known vulnerabilities in dependencies or in the codebase itself
- **Critical bug fixes** — only when a bug causes data loss, a security regression, or breaks the tool entirely

We do **not** merge:

- New features
- Non-security dependency bumps (unless they are required by a security fix)
- Style or refactor changes
- Anything that could alter the public API or CLI interface

## Node.js version support

We target the Node.js **Active LTS** and **Current** release lines as defined by the [Node.js release schedule](https://nodejs.org/en/about/previous-releases):

```
^20.19.0 || ^22.12.0 || >=24.0.0
```

Older Node.js versions are not supported. If a security fix requires dropping an EOL version, we will do so and bump the minor version accordingly.

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Patch** (`x.y.Z`) — security or critical bug fix, no API/CLI change
- **Minor** (`x.Y.0`) — dropped EOL Node.js support, or a dependency bump that changes runtime behaviour in a limited way
- **Major** (`X.0.0`) — reserved; we aim never to need one

We start version numbering where the upstream left off, so the version number is a drop-in continuation of `http-server`.

## Supply-chain transparency

All releases are published with **npm provenance attestation** (`publishConfig.provenance: true`). This means every published version is cryptographically linked to its GitHub Actions workflow run and source commit. You can verify this on the [npm package page](https://www.npmjs.com/package/@pkg-nec/http-server).

## Reporting vulnerabilities

Please report security issues privately via [GitHub Security Advisories](https://github.com/pkg-nec/http-server/security/advisories/new). Do not open public issues for unpatched vulnerabilities. See [SECURITY.md](./SECURITY.md) for full details.

## Contributing

Because this fork is security-patches-only, we do not accept feature pull requests. We welcome:

- Reports of known CVEs in dependencies
- Pull requests that patch a specific, documented vulnerability
- Corrections to documentation
