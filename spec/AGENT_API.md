# Knotdown Agent API 0.1

This document defines the read-only, language-neutral projection of `KnowledgeRuntime`. The loopback HTTP server and stdio MCP adapter implement this contract. Adapters delegate to the same runtime methods rather than reimplement search, traversal, or context selection.

## Envelope

Successful responses use:

```json
{
  "protocol_version": "0.1",
  "ok": true,
  "data": {},
  "diagnostics": []
}
```

Failed responses use:

```json
{
  "protocol_version": "0.1",
  "ok": false,
  "error": {
    "code": "KR001",
    "message": "query is required."
  },
  "diagnostics": []
}
```

Wire keys are `snake_case`. Unknown request fields and values of the wrong type fail closed with `KR001`. Responses never expose project-root absolute paths or canonical filesystem paths. The URL pins every request to exactly one project slug; the runtime still executes with the compiled project ID as its mandatory scope.

## Operations

### Describe project

```http
GET /api/v1/projects/{project_slug}
```

Returns the project ID, build ID, document count, and supported read capabilities.

### Search knowledge

```http
GET /api/v1/projects/{project_slug}/search?q={query}&limit={positive_integer}
```

Search is deterministic. Exact ID, path, title, alias, and import-label matches precede weighted lexical matches. Results include score and matched fields.

### Read document

```http
GET /api/v1/projects/{project_slug}/documents/{document_id}?representation=full|summary|metadata
```

The returned content begins with the untrusted-knowledge instruction boundary and includes the document ID, project-relative source path, representation, and incoming/outgoing relationships.

### Traverse graph

```http
GET /api/v1/projects/{project_slug}/traverse?start={id_or_name}&direction=outgoing|incoming|both&relations=imports,embeds,references&depth=1&max_documents=16
```

Traversal is breadth-first, cycle-safe, project-scoped, depth-bounded, and document-bounded. Returned nodes include discovery reasons and ID paths.

### Build context

```http
POST /api/v1/projects/{project_slug}/context
Content-Type: application/json

{
  "query": "why authentication is required",
  "entrypoint": "knowledge/procedures/checkout.md",
  "depth": 1,
  "token_budget": 4000,
  "max_documents": 12,
  "relations": ["imports", "embeds", "references"]
}
```

### Explain context

```http
POST /api/v1/projects/{project_slug}/context/explain
Content-Type: application/json
```

The request body is identical to `build context`. Each included or excluded candidate contains its decision, representation or exclusion reason, selection reason, and graph traversal path. For the same build and request, included decisions must match the `build context` item IDs, order, representations, reasons, paths, and token estimates.

## Errors

| Code | HTTP status | Meaning |
|---|---:|---|
| `KR001` | 400 | Invalid or missing request input |
| `KR002` | 403 | Project scope mismatch |
| `KR003` | 404 | Project or document not found |
| `KR409` | 409 | Current build has blocking compiler diagnostics |
| `KR500` | 500 | Unexpected runtime failure |

Request bodies are limited to 1 MiB. The development server binds to `127.0.0.1`, is read-only, and is not approved for remote exposure.

## MCP stdio projection

`knotdown mcp PROJECT_ROOT` reads one UTF-8 JSON-RPC message per line and writes one response per line. It exposes `search_knowledge`, `read_document`, `traverse_graph`, `build_context`, and `explain_context`. Every tool is annotated read-only and requires the exact loaded `project_id`. Tool results include `structuredContent` and a text rendering; domain errors use `isError: true` while unknown protocol methods use JSON-RPC errors.

The adapter supports MCP protocol revision `2026-07-28` discovery and the `2025-11-25` initialization exchange. It has no independent index, graph, or context policy.
