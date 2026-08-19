# Knotdown

> Markdown for humans. Scoped, explainable background context for AI agents.

![Alpha](https://img.shields.io/badge/status-alpha-f59e0b)
![Node](https://img.shields.io/badge/node-%3E%3D22.18-43853d)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

Knotdown is a local-first, project-scoped Markdown background-context framework. One deterministic compiler turns ordinary Markdown into a Human View, typed Graph View, explainable Context Pack, read-only MCP tools, and a deployable static site.

Use Obsidian—or any Markdown editor—as the authoring environment. Knotdown can adopt one existing vault subfolder without rewriting its notes, then keep browser and AI access inside that folder.

Knotdown is not an answer engine and does not ask an LLM to rewrite your notes. It prepares the validated, scoped project background an external agent needs before it reasons or acts.

```text
Markdown folder + .knowledge/project.yaml
                     │
               one compiled IR
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      Human        Graph      Context
       HTML      typed edges   pack + MCP
```

No LLM, embeddings, database, cloud account, or network access is required to compile a project.

> [!IMPORTANT]
> `0.1.0-alpha.1` is prepared for public release but is not published yet. Until the npm release exists, use the source-checkout commands below. Alpha APIs may change before 1.0.

## Why Knotdown

Markdown is portable, but a folder alone does not define a safe project boundary, stable identity, typed links, deterministic output, or an explanation of what an AI received. Knotdown adds those contracts while leaving Markdown authoritative.

- **Human:** rendered notes, navigation, backlinks, hover previews, diagnostics, and Open in Obsidian.
- **Graph:** deterministic `imports`, `references`, `embeds`, and weak `mentions` edges.
- **Context:** token-budgeted project background with a reason, graph path, representation, and token estimate for every inclusion—and a reason for every exclusion.
- **One IR:** the browser, static export, HTTP API, and MCP adapter cannot quietly disagree about the build.
- **Hard scope:** outside-root paths, symlink escapes, missing links, and ambiguous Obsidian names fail closed.

Knotdown is a framework with a CLI tool: the CLI runs it, while the project manifest, compiler IR, graph rules, background-context contract, and renderer adapters define how other integrations extend it. See [positioning and benchmarks](docs/positioning.md).

## Background context, not answer generation

An agent supplies a project, its current task, an optional working document, and a token budget. Knotdown turns the project's Markdown into an evidence pack with five layers:

| Layer | What it gives the agent |
| --- | --- |
| Project baseline | Purpose, vocabulary, architecture, and shared constraints |
| Working context | The document or area currently being changed |
| Task context | Knowledge relevant to the current request |
| Dependencies | Imported, referenced, or embedded supporting knowledge |
| Trace | Source paths, inclusion reasons, graph paths, token cost, and exclusions |

The intended selection model is:

```text
baseline + entrypoint + query matches + graph dependencies
                              |
                              v
                 explainable Context Pack
                              |
                              v
                    Codex / Claude / agent
```

The current alpha already provides scoped entrypoint or lexical-query selection, graph expansion, token budgeting, provenance, and inclusion/exclusion explanations. Always-on project baselines and combined entrypoint-plus-query selection are the next context-runtime milestone. Agent View is therefore a **Context Debugger**: it shows exactly what an external agent would receive, rather than generating an answer itself. See the [background-context model](docs/background-context.md).

## Quick start

After the alpha is published, initialize the folder with the dialect that matches your notes:

```bash
# Existing standard Markdown with Knotdown frontmatter
npx knotdown@next init "/path/to/docs" --preset standard
npx knotdown@next check "/path/to/docs" && npx knotdown@next dev "/path/to/docs"

# Existing Obsidian project folder
npx knotdown@next init "/path/to/vault/project" --preset obsidian
npx knotdown@next adopt "/path/to/vault/project" && npx knotdown@next dev "/path/to/vault/project"
```

Today, run the prepared package from a source checkout:

```bash
npm ci && npm run build
node dist/packages/cli/src/main.js dev examples/obsidian-vault/product-alpha
```

Open the printed `127.0.0.1` URL. Try the Human, Graph, and Agent tabs; then press `Ctrl+C`.

## Explore the examples

Each example now opens on a short Overview or Home tour instead of an arbitrary first file:

| Example | Command | What it demonstrates |
| --- | --- | --- |
| Obsidian project | `npm run dev:obsidian` | Wikilinks, aliases, embeds, sidecar IDs, excluded sibling folder |
| Knotdown framework | `npm run dev:knotdown` | A self-describing project with architecture, Markdown contracts, Obsidian, MCP, diagnostics, and background context |
| Research knowledge | `npm run dev:research` | Claim-to-evidence navigation and context explanation |

Run one development server at a time. `npm run build:examples` creates a deployable static site and `llms.txt` for all three. See the [example tour guide](examples/README.md) for suggested clicks and queries.

## Use existing Markdown

Knotdown does not import notes into a database or replace their syntax. Add one generated `.knowledge/project.yaml`, then compile the files in place:

| Your folder | Preset | Existing-note contract |
| --- | --- | --- |
| Standard Markdown | `standard` | UUID `id`, `type`, and one level-one heading per document |
| Obsidian project folder | `obsidian` | Frontmatter is optional; `adopt` creates stable IDs in a sidecar |

Standard Markdown reference definitions such as `[authentication]: ./authentication.md` declare imports. Using `[authentication]` in the body creates a strong reference edge. Ordinary inline links like `[Authentication](./authentication.md)` still navigate in Human View, but do not declare graph semantics in v0.1.

If existing standard notes already satisfy those contracts, `init --preset standard` followed by `check` works immediately. If they do not, `check` reports exactly what is missing and leaves every note unchanged. See [adopting existing Markdown](docs/adopting-existing-markdown.md).

## What the alpha includes

- Standard Markdown imports using reference definitions
- Obsidian `[[wikilinks]]`, aliases, heading/block fragments, and `![[embeds]]`
- Optional frontmatter in Obsidian mode and explicit sidecar UUIDv7 adoption
- Stable, source-located common IR and deterministic build IDs
- Atomic JSON, graph, agent-Markdown, and static-site artifacts
- HTML, Markdown, and JSON document representations
- Static Human, Graph, and prebuilt Agent views plus `llms.txt`
- Lexical search and cycle-safe typed graph traversal
- Explainable, budgeted context with an untrusted-content boundary
- Versioned loopback Agent API
- Five read-only MCP stdio tools backed directly by the shared runtime
- Node 22/24 CI design, clean npm tarball verification, OIDC trusted-publishing workflow, and provenance

## Obsidian without a vault migration

Choose the subfolder that represents one project:

```text
My Vault/
├── Daily/                         outside scope
├── Personal/                      outside scope
└── Projects/
    └── product-alpha/             Knotdown root
        ├── .knowledge/
        ├── Home.md
        └── notes/
```

`init --preset obsidian` creates project metadata. `adopt` writes stable path-to-ID mappings under `.knowledge/`; it does not add properties to notes. `check`, `build`, `dev`, and `mcp` never change notes or the identity sidecar.

```markdown
# Product Alpha

Read [[Local First|the local-first principle]].
See the supporting ![[notes/References#Sources]].
```

Resolution tries an exact ID, explicit path, then a unique basename, title, or alias. Missing links are `KB207`, ambiguous names are `KB208`, and boundary escapes are `KB202`; Knotdown never guesses. See the [Obsidian guide](docs/integrations/obsidian.md) and [runnable example](examples/obsidian-vault/product-alpha).

## CLI

| Command | Purpose | Writes source? |
|---|---|---:|
| `knotdown init ROOT --preset standard\|obsidian` | Create project configuration; Obsidian also gets an empty identity sidecar | No notes |
| `knotdown adopt ROOT` | Explicitly add missing sidecar identities | Sidecar only |
| `knotdown check ROOT` | Validate config, scope, identity, and links | No |
| `knotdown build ROOT` | Atomically compile artifacts and optional static site | Generated output only |
| `knotdown dev ROOT` | Run the loopback Knowledge Browser and watcher | No |
| `knotdown graph ROOT` | Print the compiled graph | No |
| `knotdown context ROOT ...` | Build an explainable background Context Pack | No |
| `knotdown mcp ROOT` | Serve five read-only tools over stdio | No |

Use `knotdown --help` for the exact syntax and `knotdown --version` for the installed version.

## Human, Graph, and Agent parity

Human View renders source-located Markdown, alternate Markdown/JSON representations, relationships, and diagnostics. Graph View visualizes and filters typed edges. Agent View acts as the Context Debugger: it shows included and excluded documents, traversal paths, token decisions, and the exact background-context envelope, with a Copy context action. In Obsidian mode, all three views offer `obsidian://` actions for their source notes when served locally.

Every view carries the same build ID. A conformance test also verifies parity with static output and MCP structured results.

## MCP and Agent API

Start the stdio server:

```bash
knotdown mcp "/absolute/path/to/project"
```

It exposes `search_knowledge`, `read_document`, `traverse_graph`, `build_context`, and `explain_context`. Every call requires the loaded project ID; every tool is read-only; returned note text is marked as untrusted evidence. The adapter supports current MCP discovery and the widely deployed 2025 initialization exchange.

`knotdown dev` also provides the same runtime over loopback HTTP:

```text
GET  /api/v1/projects/{slug}/search?q=...
GET  /api/v1/projects/{slug}/documents/{id}?representation=full
GET  /api/v1/projects/{slug}/traverse?start=...&relations=imports,embeds,references
POST /api/v1/projects/{slug}/context
POST /api/v1/projects/{slug}/context/explain
```

See the [Agent API and MCP contract](spec/AGENT_API.md).

## Static hosting

With `site` or `llms-txt` in `build.emit`:

```bash
knotdown build /path/to/project
```

produces:

```text
.knowledge/dist/
├── manifest.json
├── diagnostics.json
├── api/documents.json
├── graph/graph.json
├── markdown/documents/{id}.md
└── site/
    ├── index.html
    ├── graph/index.html
    ├── agent/index.html
    ├── docs/{id}/{index.html,index.md,index.json}
    └── llms.txt
```

The site contains no local absolute paths. Deploy only `.knowledge/dist/site`; provider settings for GitHub Pages, Cloudflare Pages, Netlify, and Vercel are in [deployment.md](docs/deployment.md).

## Architecture

```text
packages/
├── core/      parser, resolver, identity, IR, graph, runtime, artifacts
├── cli/       public command-line interface
├── server/    loopback HTTP and watch transport
├── mcp/       read-only JSON-RPC/stdin transport
└── web/       Human, Graph, Agent, static, and theme renderers
```

Core does not depend on web, HTTP, MCP, an LLM, embeddings, or hosted storage. Renderer themes live in `knotdown/web` and cannot change compiler semantics or build IDs; see the [theme extension contract](docs/extensions/themes.md).

## Verification

```bash
npm ci
npm run verify
npm run release:check
```

`release:check` builds and tests the repository, creates the exact npm tarball, rejects TypeScript source/repository-only leakage, installs it into a clean consumer, and smoke-tests the installed CLI—including `dev` and MCP.

The suite covers valid and invalid parsing, outside-root and symlink escapes, project isolation, ambiguous Obsidian links, non-mutating adoption/builds, deterministic graphs, atomic output, static-path privacy, HTML escaping, runtime scoping, and representation parity.

## Limits of 0.1 alpha

- The parser implements the documented conformance subset, not all CommonMark/GFM or Obsidian features.
- Attachments, Canvas, Bases, and Obsidian plugin metadata are outside the IR.
- A moved sidecar-identified note needs an explicit identity-entry move to preserve its ID.
- Search is deterministic and lexical; semantic adapters are not included.
- Context selection currently starts from either an entrypoint or lexical query. Always-on baselines, merged entrypoint-plus-query candidates, and section-level selection are not yet implemented.
- The deterministic graph layout targets small and medium project examples.
- The npm package, hosted demo, repository URLs, and community settings still require the maintainer's external setup.

## Documentation

- [Five-minute tutorial](docs/tutorial.md)
- [Background-context model](docs/background-context.md)
- [Adopting existing Markdown](docs/adopting-existing-markdown.md)
- [한국어 가이드](docs/guide.ko.md)
- [Core specification](spec/SPEC.md)
- [Obsidian integration](docs/integrations/obsidian.md)
- [Positioning and benchmarks](docs/positioning.md)
- [Deployment](docs/deployment.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
