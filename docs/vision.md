# Knotdown direction

## North star

Knotdown is a local-first, project-scoped Markdown background-context framework. People author ordinary files with tools such as Obsidian, while external agents receive the same validated knowledge as scoped, explainable Context Packs before they reason or act. The framework is the contract; the compiler, runtime, CLI, Knowledge Browser, and MCP/API adapters are its current delivery mechanisms.

Knotdown is not an answer engine. Markdown remains canonical, and Agent View is a Context Debugger for the exact background supplied to other agents.

The concise product promise is:

> Markdown for humans. Scoped, explainable background context for AI agents.

The defining promise is:

> A human and an agent may receive different representations, but both representations come from the same source-located build IR and retain identity, provenance, scope, and selection reasons.

Knotdown is not positioned as another web application framework or another Obsidian clone. It sits between documentation frameworks, linked-note systems, and background-context infrastructure. Its distinguishing contract is that all human and agent projections share one explicit project boundary and one explainable compiler result. See [positioning and benchmarks](positioning.md).

## System boundary

```text
Markdown + .knowledge/project.yaml        canonical source
                    |
                    v
compiler -> validated IR -> graph         semantic core
                    |
        +-----------+-----------+
        |           |           |
      Human      Context      Derived
    Obsidian/Web HTTP/MCP/SDK  index/cache
```

- Markdown and project configuration are authoritative.
- Graphs, search indexes, databases, embeddings, and generated pages are rebuildable projections.
- Obsidian is an authoring adapter, not a required runtime dependency.
- HTTP and MCP are transports over the same `KnowledgeRuntime` contract; language SDKs can follow it later.
- The core remains useful without an LLM, network, database, or embedding model.

## Product principles

### One source, several projections

Human HTML, Agent Markdown, JSON, graph traversal, search, and context packing consume one compiler result. A transport must not implement its own retrieval policy.

### Human-first authoring, agent-native reading

People keep readable Markdown and familiar editors. Agents receive bounded, untrusted-content-wrapped representations with stable IDs, source paths, build IDs, and inclusion reasons.

### Explainability before retrieval sophistication

Every selected or omitted context candidate has a reason and traversal path. Optional semantic search may add candidates later, but it cannot bypass project scope, deterministic fallback behavior, or provenance.

### Explicit and reviewable mutation

Read operations never rewrite sources. Future agent writes must be proposed as patches, validated against the next build, and applied only through an explicit mutation command or human approval flow.

### Transport independence

MCP is an important integration, not the product boundary. The read contract is implemented once in core and projected through local HTTP and the read-only MCP adapter.

## Delivery sequence

- [x] Compile project-scoped Markdown into one source-located IR.
- [x] Build deterministic typed graph and explainable context packs.
- [x] Provide Human, Graph, and Agent/Context Debugger views.
- [x] Provide transport-independent `search`, `read`, `traverse`, `build_context`, and `explain_context` operations.
- [x] Expose those operations through a versioned loopback JSON API.
- [x] Add first-class Obsidian dialect normalization for wikilinks, aliases, and embeds.
- [x] Add an explicit `adopt` workflow for assigning stable IDs to existing notes.
- [x] Add a read-only MCP adapter that delegates to `KnowledgeRuntime`.
- [x] Export static Human, Graph, and Agent views with Markdown alternates and `llms.txt`.
- [ ] Publish stable JavaScript and Python SDKs over the same protocol.
- [ ] Add proposed-patch, validation-preview, approval, and atomic-apply workflows for agent-assisted authoring.

## Non-goals

Knotdown is not a proprietary editor, a mandatory vector database, an autonomous source-rewriting agent, or an MCP-only server. It does not make generated indexes authoritative and does not require users to surrender portable Markdown.
