# Phase 0 implementation plan

## Exit criteria

- A normative specification defines parse, resolution, graph, ordering, isolation, and context behavior precisely enough for an independent implementation.
- Versioned project and document JSON Schemas are present.
- At least 20 named parser/resolver/context conformance scenarios are machine-readable.
- Software and research examples pass validation.
- The software example covers six related guide, concept, procedure, service, and runbook documents with deterministic graph JSON, hover metadata, reverse dependencies, and an explainable context pack.

## Sequence

- [x] Record language, naming, deterministic conventions, and scope.
- [x] Establish the normative specification and schemas.
- [x] Define fixture cases and expected diagnostics or graph counts.
- [x] Implement the common IR and source-located parsers.
- [x] Implement project-safe import resolution and typed graph construction.
- [x] Implement deterministic artifacts and context packing.
- [x] Verify golden output, project isolation, cycles, boundary rejection, and token limits.

## Deferred decisions

- Full CommonMark/GFM implementation dependency strategy
- Tokenizer adapters beyond the built-in Unicode/CJK behavior

## Alpha follow-through completed

- [x] Prepare the public `knotdown` npm package and compiled JavaScript executable.
- [x] Add Node 22/24 CI, clean-tarball installation smoke tests, and OIDC/provenance release automation.
- [x] Add the Obsidian preset, sidecar adoption, wikilinks, fragments, embeds, and boundary conformance tests.
- [x] Add the standard Markdown preset and non-mutating existing-folder adoption tests and documentation.
- [x] Add a read-only MCP adapter over the shared runtime.
- [x] Add static Human, Graph, and Agent output, Markdown/JSON alternates, `llms.txt`, deployment docs, and an editor-independent theme contract.

Repository creation, final URLs, npm package ownership, trusted-publisher account settings, and actual deployment remain explicit maintainer actions in `docs/maintainers/manual-setup.md`.
