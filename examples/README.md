# Knotdown examples

Each example is a complete project with its own `.knowledge/project.yaml`. Start with the Obsidian example for the broadest feature tour.

## Obsidian project folder

```bash
npm run dev:obsidian
```

Shows optional frontmatter, sidecar identities, aliases, wikilinks, heading and block fragments, embeds, an excluded sibling folder, all three browser views, and static export.

## Knotdown framework

```bash
npm run dev:knotdown
```

This is Knotdown explaining itself as a real Markdown project. Eight documents cover the product purpose, Background Context model, project boundary, compiler/runtime architecture, Markdown contract, Obsidian adoption, MCP integration, and context diagnostics.

The example is deliberately self-describing: Human View teaches the framework, Graph View reveals how its own concepts depend on each other, and Agent View builds a Context Pack from those same files.

## Research knowledge

```bash
npm run dev:research
```

Shows a research claim connected to its supporting paper and a small evidence-oriented context request.

## Suggested browser tour

1. Begin on the Overview or Home page selected automatically.
2. In the Knotdown framework example, follow Background Context, Compiler and Runtime, Markdown Contract, Obsidian Adoption, and MCP Integration; inspect Outgoing and Used by.
3. Open Graph View and switch relation filters. The project has eight documents, eighteen imports, eighteen explicit references, and one weak mention.
4. Open Agent View, set Markdown Contract as the entrypoint, query `기존 Markdown을 Agent 배경으로 제공하는 방법`, and inspect included/excluded reasons.
5. Run `npm run build:examples` to generate static sites for all three projects.
