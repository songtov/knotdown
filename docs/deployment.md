# Deploy the static knowledge site

`knotdown build PROJECT_ROOT` emits a self-contained site at `PROJECT_ROOT/.knowledge/dist/site` when `build.emit` contains `site` or `llms-txt`. It includes Human, Graph, and prebuilt Agent views, Markdown and JSON alternates, and `llms.txt`. The output contains project-relative paths only.

Build before deploying:

```bash
npm install --save-dev knotdown@next
npx knotdown build ./docs-project
```

Use `npx knotdown@next ...` instead until a local dependency is added.

## GitHub Pages

Configure a Pages workflow to run `npm ci`, then `npx knotdown build ./docs-project`, and upload `docs-project/.knowledge/dist/site` as the Pages artifact. Keep workflow permissions read-only except for the dedicated Pages deployment job. The repository connection and Pages environment are maintainer steps documented in `docs/maintainers/manual-setup.md`.

## Cloudflare Pages

- Build command: `npm ci && npx knotdown build ./docs-project`
- Output directory: `docs-project/.knowledge/dist/site`
- Node version: 24

## Netlify

- Build command: `npm ci && npx knotdown build ./docs-project`
- Publish directory: `docs-project/.knowledge/dist/site`
- Set `NODE_VERSION=24`.

## Vercel

- Framework preset: Other
- Build command: `npm ci && npx knotdown build ./docs-project`
- Output directory: `docs-project/.knowledge/dist/site`
- Node version: 24

For every provider, deploy only the generated `site` directory—not the vault root, `.obsidian`, `.knowledge/identities.json`, or source folders outside the selected project.
