# ADR 0001: Language, working name, and first vertical slice

- Status: superseded by ADR 0002
- Date: 2026-08-12

## Decision

The working project name is **Markup** and the provisional executable is `markup`. The repository uses a TypeScript monorepo running directly on Node.js 26. The first slice has no runtime dependencies: a source-located Markdown scanner and a safe YAML subset parser are implemented in core so conformance does not depend on network installation.

The first slice implements `check`, `build`, `graph`, and `context`. Source-mutating commands, transports, and UI follow only after the compiler contract passes its fixtures.

## Deterministic conventions

- Source locations are 1-based lines and UTF-16 columns.
- Paths in IR and artifacts are project-relative POSIX paths.
- Markdown reference labels are NFC-normalized, internal whitespace is collapsed, and comparison is case-insensitive.
- Build IDs and edge IDs are SHA-256-based content identities, not timestamps.
- JSON object keys and set-like arrays have specified stable ordering.
- Document status defaults to `draft`.
- A fragment import resolves to the document and emits `KB206`; section identity is not promised in v0.1.
- Korean/CJK labels may be followed by grammatical particles and still count as implicit mentions. ASCII labels require identifier boundaries.

## Consequences

The zero-dependency scanner deliberately supports the normative v0.1 authoring subset rather than every YAML feature or every CommonMark extension. Unsupported YAML constructs fail closed with a diagnostic. Before a public release, the working name must receive package, trademark, and ecosystem collision review.
