# Adopting existing Markdown

Knotdown compiles a folder in place. It does not copy notes into a database, invent a second source format, or rewrite Markdown during `init`, `check`, `build`, `dev`, or `mcp`.

## Choose a preset

| Preset | Use it when | Stable identity | Link semantics |
| --- | --- | --- | --- |
| `standard` | Notes can carry explicit framework contracts | UUID in each note's frontmatter | Markdown reference definitions |
| `obsidian` | An existing Obsidian subfolder should remain unchanged | `.knowledge/identities.json` sidecar | Wikilinks and embeds |

The presets produce the same compiler IR and the same Human, Graph, Agent, API, and MCP projections. They differ only at the source-adapter boundary.

## Standard Markdown

Initialize and validate an existing folder:

```bash
cd "/path/to/docs"
npx knotdown@next init . --preset standard
npx knotdown@next check .
npx knotdown@next dev .
```

Each discovered note needs:

```markdown
---
id: "019ffc11-0000-7000-8000-000000000010"
type: "concept"
---

[authentication]: ./authentication.md

# Checkout

Complete [authentication] before confirming the order.
```

- `id` must be a UUID; UUIDv7 is recommended.
- `type` is a project-defined document category such as `concept`, `procedure`, `service`, or `runbook`.
- One level-one heading supplies the document title.
- A local Markdown reference definition targeting another `.md` file declares an `imports` edge. Using its label creates a `references` edge.
- An ordinary inline link still works as Human View navigation, but v0.1 does not treat it as a typed graph declaration.

If all notes already satisfy these contracts, they are usable immediately after `init`. Otherwise `check` reports missing IDs, types, headings, unresolved targets, and boundary violations without changing the notes.

## Obsidian

Point Knotdown at the subfolder that represents one project, not necessarily the vault root:

```bash
cd "/path/to/vault/Projects/product-alpha"
npx knotdown@next init . --preset obsidian
npx knotdown@next adopt .
npx knotdown@next check .
npx knotdown@next dev .
```

`adopt` is explicit because it writes stable path-to-ID mappings under `.knowledge/`. It does not insert frontmatter into notes. Knotdown resolves `[[wikilinks]]`, aliases, heading and block fragments, and `![[embeds]]` inside the selected project boundary.

## Safe adoption checklist

1. Choose the narrowest folder that is one project.
2. Run `init`, then review `.knowledge/project.yaml` include and exclude patterns.
3. For Obsidian, run `adopt`; for standard Markdown, add only the contracts reported by `check`.
4. Keep running `check` until blocking diagnostics are gone.
5. Run `dev` and inspect Human, Graph, and Agent View before exposing the static output or MCP server.

Knotdown rejects outside-root paths and symbolic-link escapes. Missing or ambiguous Obsidian targets also fail closed instead of being guessed.
