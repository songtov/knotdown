# Repository instructions

- Treat Markdown sources and `.knowledge/project.yaml` as canonical input.
- Never edit source documents from `check` or `build`.
- Preserve project scoping, stable IDs, deterministic ordering, and source locations.
- Keep the core compiler independent of browser, HTTP, and MCP transports.
- Add both a success and failure test for changes to parsing, resolution, graph construction, or context packing.
- Do not add mandatory AI, embedding, network, cloud, or database dependencies.
- Generated `.knowledge/dist/` content must not be edited by hand.
- Do not commit, push, publish, or deploy unless the user explicitly asks.
