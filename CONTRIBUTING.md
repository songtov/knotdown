# Contributing

Knotdown is specification-first. A behavioral change starts with a specification or decision-log update, then a conformance fixture, implementation, and tests.

## Local checks

```bash
npm ci
npm run verify
npm run release:check
```

Development requires Node.js 22.18 or newer. `release:check` builds a real npm tarball, installs it into a clean temporary consumer, and smoke-tests the installed CLI, MCP server, and Knowledge Browser.

Keep generated output out of patches. New parser, resolver, graph, or context behavior needs at least one success case and one failure or boundary case. Do not make core correctness depend on network access, an LLM, embeddings, or a hosted database.

Specification changes should be proposed as an RFC before implementation once the repository begins accepting external contributions.
