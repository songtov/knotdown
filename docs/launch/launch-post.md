# Launch post draft

## Title

Knotdown: turn one Markdown folder into a browsable knowledge graph and scoped AI context

## Short post

I built Knotdown because my Markdown notes had two audiences with different needs: people want a clean site and graph, while AI tools need a small, inspectable context boundary.

Knotdown compiles one project folder into Human, Graph, and Agent views from a single deterministic IR. It works with ordinary Markdown and can adopt an existing Obsidian subfolder without editing the notes. Wikilinks, aliases, heading/block fragments, and embeds become typed relationships; ambiguous or outside-project links fail closed. The same runtime powers the browser, HTTP API, and five read-only MCP tools.

The alpha is local-first and dependency-light: no cloud account, embeddings, database, or source mutation is required. `knotdown build` also emits a static site, Markdown/JSON alternates, and `llms.txt`.

I would especially value feedback on real Obsidian folder structures, ambiguity diagnostics, and whether the context explanation makes AI retrieval easier to trust.

## Suggested links

Add the final GitHub repository, hosted demo, npm package, five-minute tutorial, and Obsidian guide after those URLs exist.
