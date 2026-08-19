# Obsidian integration

Obsidian is a first-class authoring environment for Knotdown. Markdown remains authoritative, and the same folder continues to work without either application running.

## Adopt an existing vault subfolder

Point Knotdown at the smallest folder that should form one project. Sibling folders are outside the root and cannot be discovered, searched, traversed, or sent to an agent.

```text
My Vault/
├── Daily/
├── Personal/
└── Projects/
    └── product-alpha/       ← Knotdown project root
        ├── Home.md
        └── notes/
```

After installing Knotdown:

```bash
cd "/path/to/My Vault/Projects/product-alpha"
npx knotdown@next init . --preset obsidian
npx knotdown@next adopt .
npx knotdown@next check .
npx knotdown@next dev .
```

`init` creates `.knowledge/project.yaml` and an empty identity sidecar. `adopt` assigns stable UUIDv7 values in `.knowledge/identities.json`. Neither command edits a note. Running `adopt` again preserves existing IDs and adds only missing paths.

Once installed locally, the shorter forms are `knotdown init`, `knotdown adopt`, and `knotdown dev`.

## Supported syntax

The Obsidian dialect accepts notes with no frontmatter and no H1. When metadata is absent, type defaults to `note`, status to `draft`, and title to the first H1 or filename.

| Syntax | Resolution | Graph relation |
|---|---|---|
| `[[Document]]` | ID, explicit path, unique basename/title/alias | `references` |
| `[[Document|Label]]` | same target; custom display retained | `references` |
| `[[Document#Heading]]` | document plus heading fragment | `references` |
| `[[Document#^block]]` | document plus block fragment | `references` |
| `![[Document]]` | document transclusion | `embeds` |

Missing links fail with `KB207`; ambiguous names fail with `KB208`; paths escaping the project fail with `KB202`. Knotdown never guesses between two notes. Add a folder path to disambiguate, such as `[[concepts/Authentication]]`.

Links inside inline or fenced code are inert. Attachments, Canvas, Bases, and `.obsidian/` metadata are not compiled in 0.1.

## Identity and moves

The sidecar maps project-relative note paths to stable IDs. If a note is moved, run:

```bash
knotdown adopt .
```

Alpha behavior assigns a new ID to the new path; if preserving identity across a move matters, move the existing sidecar entry in the same change before building. A future rename-aware adoption helper may automate this, but it will remain explicit.

## Editing loop

Keep writing in Obsidian. `knotdown dev .` supplies read-only Human, Graph, and Agent views. All three views include **Open in Obsidian** actions for the notes they show. Agent View also exposes the exact context, inclusion path, reason, token estimate, exclusions, and build ID. **Copy context** copies the untrusted-content envelope and selected notes.

`check`, `build`, `dev`, and `mcp` do not write notes or the sidecar. `build` writes only the configured `.knowledge/dist` directory using an atomic replacement.

## Example

The runnable English example at `examples/obsidian-vault/product-alpha` demonstrates a project subfolder beside an excluded `personal` folder, optional frontmatter, aliases, wikilinks, a heading embed, a block reference, and a generated static site.
