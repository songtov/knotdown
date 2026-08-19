# Five-minute tutorial

## 1. Try the Obsidian-shaped example

```bash
npm install
npm run build
node dist/packages/cli/src/main.js check examples/obsidian-vault/product-alpha
```

The result should report three documents and no diagnostics. The sibling `examples/obsidian-vault/personal` note is outside the project root.

## 2. Open all three views

```bash
node dist/packages/cli/src/main.js dev examples/obsidian-vault/product-alpha
```

Open the printed loopback URL. Human View renders Markdown and resolved links. Graph View shows typed `references` and `embeds` edges. Agent View explains what enters a context pack and why.

## 3. Build portable output

```bash
node dist/packages/cli/src/main.js build examples/obsidian-vault/product-alpha
```

Open `.knowledge/dist/site/index.html` through a static file server or deploy that directory. Inspect `site/llms.txt` and any `site/docs/{id}/index.md` alternate.

## 4. Adopt your own folder

For standard Markdown that already has an ID, type, and H1 in every document:

```bash
cd "/path/to/your/docs"
npx knotdown@next init . --preset standard
npx knotdown@next check .
npx knotdown@next dev .
```

For an Obsidian project folder:

```bash
cd "/path/to/your/vault/project-folder"
npx knotdown@next init . --preset obsidian
npx knotdown@next adopt .
npx knotdown@next check .
```

Review `.knowledge/project.yaml`, especially `content.roots`, `include`, and `exclude`. Add explicit paths when a wikilink name is ambiguous. Both presets leave your Markdown unchanged; only explicit Obsidian `adopt` writes the identity sidecar. See the [full adoption guide](adopting-existing-markdown.md).

## 5. Connect an AI client

Configure a stdio MCP server command equivalent to:

```bash
npx knotdown@next mcp "/absolute/path/to/project-folder"
```

The five tools are read-only. Each request requires the project ID printed by `knotdown check --format json`; content is returned behind an untrusted-evidence boundary.
