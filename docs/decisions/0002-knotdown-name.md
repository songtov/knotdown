# ADR 0002: Adopt Knotdown as the public working name

- Status: accepted
- Date: 2026-08-13
- Supersedes: ADR 0001 naming decision only

## Decision

The framework's public working name is **Knotdown** and its executable is `knotdown`.

The name combines two product ideas:

- **knot**: document-scoped reference bindings are tied into a typed knowledge graph;
- **down**: Markdown remains the human-readable source of truth.

Canonical command examples are:

```bash
knotdown init
knotdown check
knotdown build
knotdown context --entry checkout.md --query "Why is authentication required?"
```

Published JavaScript packages use the `@knotdown/*` scope when that scope is available. The root package is named `knotdown`. The compiler identity is `knotdown-core-0.1`, so the intentional rename changes deterministic build IDs without changing edge IDs or source identities.

## Preliminary collision check

As of 2026-08-13, exact-name web and GitHub searches found no active developer framework named Knotdown, and the npm registry returned `E404` for the unscoped `knotdown` package. This is preliminary product research, not legal trademark clearance. Before public release, maintainers must still check npm organization ownership, GitHub organization and repository names, Homebrew, domains, and relevant trademark registries.

## Migration scope

- Rename product text, executable names, package names, schema IDs, temporary test prefixes, and compiler identity.
- Keep `.knowledge/` as the format-level project directory because it is descriptive and portable rather than product-branded.
- Keep generic internal directories such as `packages/core` and `packages/cli`.
- Do not rename the current repository root; the user will rename it separately.
