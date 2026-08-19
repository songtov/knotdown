# Knotdown positioning and benchmarks

This document keeps product language and implementation priorities aligned. It is not a claim that every adjacent feature is novel.

## Category

Knotdown is a **project-scoped Markdown background-context framework for people and AI agents**.

- The **framework** defines project boundaries, document identity, relationship semantics, deterministic builds, and representation parity.
- The **compiler and runtime** turn those rules into one source-located IR and explainable background Context Packs.
- The **CLI and Knowledge Browser** are the current user-facing tools.
- Static hosting, MCP, and editor integrations are projections and adapters over the same core contract; language SDKs remain future adapters.

Do not describe Knotdown only as a tool; that hides the reusable contract. Do not describe it as a generic web framework; that implies an application runtime like Rails or Next.js. “Markdown background-context framework” is the public category, while “compiler, runtime, and CLI” explains how it works today.

## Public promise

> Markdown for humans. Scoped, explainable background context for AI agents.

Expanded:

> Turn any Markdown folder—including one inside an Obsidian vault—into a browsable knowledge graph and safe, explainable background Context Packs without migrating the source notes.

Knotdown provides evidence before an external agent reasons or acts. It does not generate the answer and does not rewrite the knowledge source.

The short proof should always show the same sequence:

```text
existing Markdown folder
        |
        v
    knotdown dev
        |
        +--> Human View: rendered notes, links, previews, backlinks
        +--> Graph View: typed project relationships
        +--> Context Debugger: exact pack, budget, paths, and reasons
```

## Benchmark map

| Project | Learn from | Do not become |
| --- | --- | --- |
| [Quartz](https://github.com/jackyzha0/quartz) | Obsidian compatibility, backlinks, graph UX, previews, static deployment | A personal digital-garden publisher with AI added as an afterthought |
| [Docusaurus](https://github.com/facebook/docusaurus) and [Material for MkDocs](https://github.com/squidfunk/mkdocs-material) | One-command start, excellent defaults, configuration, plugins, themes, deploy guides | A linear documentation site generator |
| [Foam](https://github.com/foambubble/foam) | Wikilink resolution, ambiguity diagnostics, graph navigation, editor cooperation | A replacement editor or a single-editor workspace format |
| [Repomix](https://github.com/yamadashy/repomix) | One-command AI value, token visibility, explicit include/exclude rules, safe defaults | A whole-repository concatenator |
| [Context7](https://github.com/upstash/context7) | Clear agent integration and a small CLI/MCP setup surface | A hosted documentation lookup service |
| [Markdoc](https://github.com/markdoc/markdoc) | Honest “framework and toolchain” language, parser/transform separation, extension contracts | A custom authoring syntax that reduces Markdown portability |

The closest product benchmark is Quartz, but Knotdown must not compete on “publish an Obsidian vault” alone. The durable difference is the synchronized human/agent compiler model and the project boundary:

> Quartz publishes connected notes. Knotdown compiles bounded project knowledge for both people and agents.

More precisely, Knotdown's agent-facing product is the Context Pack: project background, current work, task-relevant knowledge, graph dependencies, and a trace explaining every selection. See the [background-context model](background-context.md).

## Product boundaries

Knotdown should remain:

- editor-agnostic and useful when Obsidian is closed;
- local-first and read-only by default;
- deterministic before adding semantic retrieval;
- explicit about which files an agent can and cannot receive;
- compatible with standard Markdown rather than dependent on a visible custom DSL;
- useful without an LLM, cloud account, database, or network connection.

Knotdown should not lead with:

- “an Obsidian alternative”;
- “another digital garden”;
- “an Obsidian MCP server”;
- “a web framework” without the Markdown knowledge qualifier;
- broad novelty claims about Markdown, graphs, RAG, or MCP.

## Alpha delivery

### P0/P1: Obsidian folder compatibility — delivered

- Initialize one vault subfolder as an isolated Knotdown project.
- Resolve supported wikilinks, aliases, headings, blocks, and embeds without rewriting notes.
- Add an explicit adoption workflow for stable identities.
- Open source notes in Obsidian from Knotdown views.
- Ship conformance fixtures that prove sibling vault folders never enter the build or background context.

### P1: Explainable agent access — delivered

- Keep Human, Graph, Agent, JSON API, and MCP results on one build ID.
- Show every included and excluded document with path, relation, reason, and token cost.
- Use a read-only MCP adapter that delegates directly to the stable core runtime.

### P1.5: Background-context assembly — next

- Add configured always-on project baseline documents.
- Merge the working entrypoint with task-query candidates.
- Promote query-relevant dependencies when token budget permits.
- Add section-level provenance and background-context evaluation fixtures.

### P2: Deployable knowledge sites — delivered

- Export self-contained Human and Graph views.
- Emit Markdown alternates and an `llms.txt` entrypoint from the same build.
- Document GitHub Pages, Cloudflare Pages, Netlify, and Vercel deployment.
- Introduce theming and extension points without coupling them to the compiler.

## Open-source presentation bar

The README hero and launch demo should prove the value in under one minute:

1. Open an existing Obsidian project folder.
2. Run one command.
3. Follow a wikilink in Human View and inspect it in Graph View.
4. Build a Context Pack and show why each document was included.
5. Show that a neighboring Personal folder was excluded.

The demo is stronger than a long feature list because it makes the boundary, human experience, and agent experience visible in one flow.
