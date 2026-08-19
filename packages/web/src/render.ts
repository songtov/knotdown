import path from "node:path";
import { normalizeLabel } from "../../core/src/index.ts";
import type {
  ContextExplanation,
  ContextPack,
  Diagnostic,
  InlineNode,
  KnowledgeDocument,
  KnowledgeEdge,
  KnowledgeProject,
  MarkdownBlock,
} from "../../core/src/index.ts";
import { renderThemeCss } from "./theme.ts";
import { selectLandingDocument } from "./landing.ts";
import type { KnotdownTheme } from "./theme.ts";

export interface BrowserRenderOptions {
  agentHref?: string;
  documentHref?: (document: KnowledgeDocument) => string;
  graphHref?: string;
  homeHref?: string;
  jsonHref?: string;
  markdownHref?: string;
  sourceHref?: string;
  theme?: KnotdownTheme;
}

export interface GraphRenderOptions {
  agentHref?: string;
  documentHref?: (document: KnowledgeDocument) => string;
  graphHref?: string;
  homeHref?: string;
  relation?: "all" | "imports" | "embeds" | "references" | "mentions";
  sourceHref?: (document: KnowledgeDocument) => string;
  theme?: KnotdownTheme;
}

export interface AgentRenderOptions {
  agentHref?: string;
  documentHref?: (document: KnowledgeDocument) => string;
  graphHref?: string;
  homeHref?: string;
  query?: string;
  entrypoint?: string;
  tokenBudget?: number;
  depth?: number;
  error?: string;
  scriptHref?: string;
  sourceHref?: (document: KnowledgeDocument) => string;
  theme?: KnotdownTheme;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function headingId(value: string, index: number): string {
  const slug = value.normalize("NFKD").toLocaleLowerCase("und")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return slug || `section-${index + 1}`;
}

function splitDestination(destination: string): { file: string; fragment: string } {
  const hash = destination.indexOf("#");
  if (hash < 0) return { file: destination, fragment: "" };
  return { file: destination.slice(0, hash), fragment: destination.slice(hash + 1) };
}

function documentRoute(project: KnowledgeProject, document: KnowledgeDocument): string {
  return `/p/${encodeURIComponent(project.slug)}/docs/${encodeURIComponent(document.id)}`;
}

function relationLabel(type: KnowledgeEdge["type"]): string {
  return ({ contains: "Contains", imports: "Imports", embeds: "Embeds", references: "References", mentions: "Mentions" })[type];
}

function renderInline(
  nodes: InlineNode[],
  project: KnowledgeProject,
  source: KnowledgeDocument,
  hrefFor: (document: KnowledgeDocument) => string,
): string {
  return nodes.map((node) => {
    if (node.type === "text") return escapeHtml(node.value).replace(/\n/gu, "<br>");
    if (node.type === "code") return `<code>${escapeHtml(node.value)}</code>`;
    if (node.type === "reference") {
      const binding = source.imports.find((item) => item.normalizedLabel === normalizeLabel(node.label));
      const target = binding ? project.documents.find((item) => item.id === binding.targetId) : undefined;
      if (!target) return `<span class="unresolved-ref">${escapeHtml(node.display)}</span>`;
      const references = project.graph.edges.filter((edge) => edge.to === target.id && edge.type === "references").length;
      return `<a class="knowledge-ref" href="${escapeHtml(hrefFor(target))}">${escapeHtml(node.display)}<span class="hover-card" role="tooltip"><strong>${escapeHtml(target.title)}</strong><span>${escapeHtml(target.type)} · ${escapeHtml(target.status)}</span><p>${escapeHtml(target.summary || "No summary")}</p><small>${references} reference${references === 1 ? "" : "s"} · Open definition →</small></span></a>`;
    }
    if (node.type === "wikilink") {
      const uses = node.embed ? source.embeds : source.wikilinks;
      const use = uses.find((item) => item.sourceLocation.line === node.location.line && item.sourceLocation.column === node.location.column);
      const target = use ? project.documents.find((item) => item.id === use.targetId) : undefined;
      if (!target) return `<span class="unresolved-ref">${escapeHtml(node.display)}</span>`;
      const suffix = use?.fragment ? `#${encodeURIComponent(use.fragment)}` : "";
      const link = `<a class="knowledge-ref" href="${escapeHtml(hrefFor(target) + suffix)}">${escapeHtml(node.display)}</a>`;
      return node.embed ? `<span class="knowledge-embed" title="Embedded note">${link}</span>` : link;
    }
    const destination = splitDestination(node.destination);
    if (/^https?:\/\//iu.test(destination.file) || /^mailto:/iu.test(destination.file)) {
      return `<a href="${escapeHtml(node.destination)}" rel="noreferrer">${escapeHtml(node.display)}</a>`;
    }
    if (!destination.file && destination.fragment) {
      return `<a href="#${escapeHtml(destination.fragment)}">${escapeHtml(node.display)}</a>`;
    }
    const targetPath = path.posix.normalize(path.posix.join(path.posix.dirname(source.path), destination.file));
    const target = project.documents.find((item) => item.path === targetPath);
    if (target) {
      const suffix = destination.fragment ? `#${encodeURIComponent(destination.fragment)}` : "";
      return `<a href="${escapeHtml(hrefFor(target) + suffix)}">${escapeHtml(node.display)}</a>`;
    }
    return `<span>${escapeHtml(node.display)}</span>`;
  }).join("");
}

function renderBlock(
  block: MarkdownBlock,
  index: number,
  project: KnowledgeProject,
  document: KnowledgeDocument,
  hrefFor: (document: KnowledgeDocument) => string,
): string {
  if (block.type === "definition") return "";
  if (block.type === "code_block") return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
  if (block.type === "paragraph") return `<p>${renderInline(block.inlines, project, document, hrefFor)}</p>`;
  const level = Math.max(1, Math.min(6, block.depth));
  return `<h${level} id="${escapeHtml(headingId(block.value, index))}">${renderInline(block.inlines, project, document, hrefFor)}</h${level}>`;
}

function tree(project: KnowledgeProject, active: KnowledgeDocument, hrefFor: (document: KnowledgeDocument) => string): string {
  const groups = new Map<string, KnowledgeDocument[]>();
  const landingId = selectLandingDocument(project)?.id;
  for (const document of project.documents) {
    const directory = document.id === landingId
      ? "start here"
      : path.posix.dirname(document.path).replace(/^knowledge\/?/u, "") || "documents";
    const list = groups.get(directory) ?? [];
    list.push(document);
    groups.set(directory, list);
  }
  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "start here") return -1;
    if (right === "start here") return 1;
    return left.localeCompare(right);
  }).map(([directory, documents]) => `
    <section class="tree-group">
      <h2>${escapeHtml(directory)}</h2>
      ${documents.map((document) => `<a class="tree-document${document.id === active.id ? " active" : ""}" href="${escapeHtml(hrefFor(document))}"><span>${escapeHtml(document.title)}</span><small>${escapeHtml(document.type)}</small></a>`).join("")}
    </section>`).join("");
}

function relationshipList(
  project: KnowledgeProject,
  edges: KnowledgeEdge[],
  direction: "incoming" | "outgoing",
  hrefFor: (document: KnowledgeDocument) => string,
): string {
  if (edges.length === 0) return `<p class="empty">None</p>`;
  return `<ul class="relation-list">${edges.map((edge) => {
    const targetId = direction === "outgoing" ? edge.to : edge.from;
    const target = project.documents.find((document) => document.id === targetId);
    if (!target) return "";
    return `<li><a href="${escapeHtml(hrefFor(target))}">${escapeHtml(target.title)}</a><small>${relationLabel(edge.type)} · ${escapeHtml(edge.strength)}</small></li>`;
  }).join("")}</ul>`;
}

function stylesheet(theme?: KnotdownTheme): string {
  return `
    :root { color-scheme: light; --ink:#17221b; --muted:#657068; --line:#dce3dc; --paper:#fbfcf9; --panel:#f2f5ef; --accent:#176c48; --accent-soft:#dff1e7; --warning:#9a5b12; }
    * { box-sizing:border-box; }
    html { background:var(--paper); color:var(--ink); font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    body { margin:0; min-height:100vh; }
    a { color:var(--accent); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .topbar { align-items:center; background:#14271d; color:white; display:flex; gap:18px; min-height:58px; padding:10px 22px; }
    .brand { color:white; font-size:15px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .project-title { color:#c7d8ce; font-size:14px; }
    .view-nav { display:flex; gap:4px; margin-left:12px; }
    .view-nav a { border-radius:6px; color:#9fb3a7; font-size:12px; font-weight:700; padding:6px 9px; }
    .view-nav a:hover { background:#233b2e; color:white; text-decoration:none; }
    .view-nav a.active { background:#e1f0e6; color:#145c3e; }
    .build { color:#90a89a; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; margin-left:auto; }
    .layout { display:grid; grid-template-columns:250px minmax(360px,1fr) 300px; min-height:calc(100vh - 58px); }
    .sidebar,.inspector { background:var(--panel); padding:24px 18px; }
    .sidebar { border-right:1px solid var(--line); }
    .inspector { border-left:1px solid var(--line); }
    .eyebrow { color:var(--muted); font-size:11px; font-weight:800; letter-spacing:.12em; margin:0 0 14px; text-transform:uppercase; }
    .tree-group { margin-bottom:22px; }
    .tree-group h2 { color:var(--muted); font-size:11px; font-weight:700; margin:0 8px 7px; text-transform:uppercase; }
    .tree-document { border-radius:8px; color:var(--ink); display:flex; flex-direction:column; gap:2px; padding:8px; }
    .tree-document:hover { background:#e8ede8; text-decoration:none; }
    .tree-document.active { background:var(--accent-soft); color:#0e593a; font-weight:700; }
    .tree-document small { color:var(--muted); font-size:10px; font-weight:500; }
    main { margin:0 auto; max-width:860px; padding:54px clamp(28px,6vw,78px) 100px; width:100%; }
    .document-meta { align-items:center; display:flex; flex-wrap:wrap; gap:8px; margin-bottom:36px; }
    .pill { background:var(--accent-soft); border-radius:999px; color:#125c3e; font-size:11px; font-weight:700; padding:5px 9px; }
    .pill.status { background:#e9eee9; color:#526058; }
    .source-path { color:var(--muted); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; margin-left:auto; }
    .source-action { border:1px solid var(--line); border-radius:6px; font-size:11px; padding:5px 8px; }
    article { font-size:17px; line-height:1.78; }
    article h1 { font-family:Georgia,"Times New Roman",serif; font-size:clamp(36px,5vw,56px); letter-spacing:-.035em; line-height:1.08; margin:0 0 32px; }
    article h2 { border-bottom:1px solid var(--line); font-size:26px; margin:54px 0 18px; padding-bottom:9px; }
    article h3 { font-size:21px; margin-top:40px; }
    article p { margin:0 0 24px; }
    code { background:#e9eee9; border-radius:4px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.88em; padding:.12em .35em; }
    pre { background:#14271d; border-radius:12px; color:#e9f1eb; overflow:auto; padding:20px; }
    pre code { background:none; padding:0; }
    .knowledge-ref { border-bottom:1px dashed var(--accent); font-weight:700; position:relative; }
    .knowledge-ref:hover { text-decoration:none; }
    .knowledge-embed { background:var(--accent-soft); border-left:3px solid var(--accent); border-radius:4px; display:inline-block; padding:2px 7px; }
    .hover-card { background:#fff; border:1px solid var(--line); border-radius:12px; bottom:calc(100% + 10px); box-shadow:0 14px 36px rgba(21,42,30,.16); color:var(--ink); display:none; font-weight:400; left:0; line-height:1.45; min-width:290px; padding:16px; position:absolute; text-align:left; z-index:5; }
    .knowledge-ref:hover .hover-card,.knowledge-ref:focus .hover-card { display:block; }
    .hover-card strong,.hover-card span,.hover-card small { display:block; }
    .hover-card span,.hover-card small { color:var(--muted); font-size:11px; }
    .hover-card p { font-size:13px; margin:10px 0; }
    .inspector section { border-bottom:1px solid var(--line); margin-bottom:22px; padding-bottom:18px; }
    .inspector h2 { font-size:12px; letter-spacing:.08em; margin:0 0 12px; text-transform:uppercase; }
    .relation-list { display:flex; flex-direction:column; gap:10px; list-style:none; margin:0; padding:0; }
    .relation-list a,.relation-list small { display:block; }
    .relation-list a { color:var(--ink); font-size:13px; font-weight:700; }
    .relation-list small,.empty { color:var(--muted); font-size:11px; margin:0; }
    .toc { display:flex; flex-direction:column; gap:7px; }
    .toc a { color:var(--muted); font-size:12px; }
    .representations { display:flex; gap:7px; }
    .representations a { border:1px solid var(--line); border-radius:6px; color:var(--ink); font-size:11px; padding:5px 7px; }
    .diagnostic { border-left:3px solid var(--warning); color:#613a0c; font-size:12px; margin:10px 0; padding-left:10px; }
    .diagnostic strong { display:block; }
    .error-page { margin:60px auto; max-width:760px; padding:0 24px; }
    .graph-layout { display:grid; grid-template-columns:minmax(0,1fr) 280px; min-height:calc(100vh - 58px); }
    .graph-main { margin:0; max-width:none; overflow:hidden; padding:34px; }
    .graph-heading { align-items:flex-end; display:flex; gap:20px; justify-content:space-between; margin-bottom:22px; }
    .graph-heading h1 { font-family:Georgia,"Times New Roman",serif; font-size:38px; letter-spacing:-.025em; margin:0 0 4px; }
    .graph-heading p { color:var(--muted); font-size:13px; margin:0; }
    .filters { display:flex; flex-wrap:wrap; gap:7px; }
    .filters a { border:1px solid var(--line); border-radius:999px; color:var(--muted); font-size:11px; font-weight:700; padding:6px 10px; }
    .filters a.active { background:var(--ink); border-color:var(--ink); color:white; }
    .graph-canvas { background:radial-gradient(circle at 1px 1px,#dce3dc 1px,transparent 0); background-size:22px 22px; border:1px solid var(--line); border-radius:14px; min-height:520px; overflow:auto; }
    .graph-canvas svg { display:block; min-height:520px; width:100%; }
    .graph-edge { fill:none; opacity:.82; stroke-width:2; }
    .graph-edge.imports { stroke:#176c48; }
    .graph-edge.embeds { stroke:#8756a8; stroke-width:3; }
    .graph-edge.references { stroke:#3267a8; }
    .graph-edge.mentions { stroke:#aa6b20; stroke-dasharray:6 5; }
    .edge-label { fill:#657068; font-size:11px; paint-order:stroke; stroke:var(--paper); stroke-width:4px; text-anchor:middle; }
    .graph-node rect { fill:#fff; stroke:#bac7be; stroke-width:1.5; }
    .graph-node:hover rect { fill:var(--accent-soft); stroke:var(--accent); stroke-width:2; }
    .node-title { fill:var(--ink); font-size:14px; font-weight:750; }
    .node-meta { fill:var(--muted); font-size:10px; }
    .graph-inspector { background:var(--panel); border-left:1px solid var(--line); padding:28px 20px; }
    .graph-inspector section { border-bottom:1px solid var(--line); margin-bottom:22px; padding-bottom:18px; }
    .graph-inspector h2 { font-size:12px; letter-spacing:.08em; margin:0 0 12px; text-transform:uppercase; }
    .stat-grid { display:grid; gap:8px; grid-template-columns:1fr 1fr; }
    .stat { background:#fff; border:1px solid var(--line); border-radius:8px; padding:10px; }
    .stat strong,.stat span { display:block; }
    .stat strong { font-size:20px; }
    .stat span { color:var(--muted); font-size:10px; text-transform:uppercase; }
    .legend { display:flex; flex-direction:column; gap:10px; }
    .legend span { align-items:center; color:var(--muted); display:flex; font-size:12px; gap:8px; }
    .legend i { border-radius:2px; display:inline-block; height:3px; width:24px; }
    .legend .imports { background:#176c48; }
    .legend .embeds { background:#8756a8; }
    .legend .references { background:#3267a8; }
    .legend .mentions { background:repeating-linear-gradient(90deg,#aa6b20 0 6px,transparent 6px 10px); }
    .agent-layout { display:grid; grid-template-columns:minmax(280px,360px) minmax(420px,1fr); min-height:calc(100vh - 58px); }
    .agent-controls { background:var(--panel); border-right:1px solid var(--line); padding:26px 22px; }
    .agent-controls h1,.agent-result h1 { font-size:22px; margin:4px 0 10px; }
    .agent-controls p,.agent-result p { color:var(--muted); font-size:13px; line-height:1.55; }
    .agent-form { display:grid; gap:14px; margin-top:24px; }
    .agent-form label { color:var(--muted); display:grid; font-size:11px; font-weight:800; gap:6px; letter-spacing:.05em; text-transform:uppercase; }
    .agent-form input,.agent-form select { background:white; border:1px solid var(--line); border-radius:7px; color:var(--ink); font:inherit; padding:9px 10px; width:100%; }
    .agent-form button { background:var(--accent); border:0; border-radius:7px; color:white; cursor:pointer; font-weight:800; padding:10px 14px; }
    .agent-result { min-width:0; padding:34px; }
    .agent-stats { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0; }
    .agent-stats span { background:var(--accent-soft); border-radius:999px; color:var(--accent); font-size:12px; font-weight:700; padding:6px 10px; }
    .decision-list { display:grid; gap:8px; margin:18px 0 26px; }
    .decision { border:1px solid var(--line); border-radius:8px; display:grid; gap:3px; padding:10px 12px; }
    .decision strong { font-size:13px; }
    .decision-source { font-size:11px; font-weight:700; margin-left:8px; }
    .decision small { color:var(--muted); }
    .decision.excluded { border-color:#ead6b9; }
    .context-output { background:#132019; border-radius:10px; color:#dce9e1; font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; max-height:65vh; overflow:auto; padding:18px; white-space:pre-wrap; }
    .copy-context { background:var(--accent); border:0; border-radius:7px; color:white; cursor:pointer; font-weight:800; margin-bottom:10px; padding:8px 12px; }
    .agent-error { background:#fff1df; border:1px solid #e9c58f; border-radius:8px; color:#7b4810; padding:12px; }
    @media (max-width:1000px) { .layout { grid-template-columns:220px 1fr; } .inspector { border-left:0; border-top:1px solid var(--line); grid-column:1/-1; } }
    @media (max-width:1000px) { .graph-layout { display:block; } .graph-inspector { border-left:0; border-top:1px solid var(--line); } }
    @media (max-width:700px) { .build,.project-title { display:none; } .view-nav { margin-left:auto; } .layout,.agent-layout { display:block; } .sidebar,.agent-controls { border-bottom:1px solid var(--line); border-right:0; } main { padding-top:36px; } .source-path { margin-left:0; width:100%; } .graph-heading { align-items:flex-start; flex-direction:column; } .graph-main,.agent-result { padding:24px 14px; } }
  ${renderThemeCss(theme)}`;
}

export function renderDocumentPage(
  project: KnowledgeProject,
  document: KnowledgeDocument,
  diagnostics: Diagnostic[] = [],
  options: BrowserRenderOptions = {},
): string {
  const hrefFor = options.documentHref ?? ((target) => documentRoute(project, target));
  const outgoing = project.graph.edges.filter((edge) => edge.from === document.id && edge.type !== "contains");
  const incoming = project.graph.edges.filter((edge) => edge.to === document.id && edge.type !== "contains");
  const documentDiagnostics = diagnostics.filter((item) => item.source.path === document.path);
  const headings = document.ast.blocks.filter((block): block is Extract<MarkdownBlock, { type: "heading" }> => block.type === "heading");
  const body = document.ast.blocks.map((block, index) => renderBlock(block, index, project, document, hrefFor)).join("\n");
  const markdownHref = options.markdownHref ?? `${hrefFor(document)}.md`;
  const jsonHref = options.jsonHref ?? `${hrefFor(document)}.json`;
  return `<!doctype html>
<html lang="${escapeHtml(project.config.project.language ?? "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(document.title)} · ${escapeHtml(project.title)}</title>
  <link rel="alternate" type="text/markdown" href="${escapeHtml(markdownHref)}">
  <link rel="alternate" type="application/json" href="${escapeHtml(jsonHref)}">
  <style>${stylesheet(options.theme)}</style>
</head>
<body>
  <header class="topbar"><a class="brand" href="${escapeHtml(options.homeHref ?? `/p/${encodeURIComponent(project.slug)}`)}">Knotdown</a><span class="project-title">${escapeHtml(project.title)}</span><nav class="view-nav" aria-label="Knowledge Browser views"><a class="active" href="${escapeHtml(hrefFor(document))}">Human</a><a href="${escapeHtml(options.graphHref ?? `/p/${encodeURIComponent(project.slug)}/graph`)}">Graph</a><a href="${escapeHtml(options.agentHref ?? `/p/${encodeURIComponent(project.slug)}/agent`)}">Agent</a></nav><span class="build">build ${escapeHtml(project.buildId.slice(0, 12))}</span></header>
  <div class="layout">
    <nav class="sidebar" aria-label="Project documents"><p class="eyebrow">Project modules</p>${tree(project, document, hrefFor)}</nav>
    <main>
      <div class="document-meta"><span class="pill">${escapeHtml(document.type)}</span><span class="pill status">${escapeHtml(document.status)}</span><span class="source-path">${escapeHtml(document.path)}</span>${options.sourceHref ? `<a class="source-action" href="${escapeHtml(options.sourceHref)}">Open in Obsidian</a>` : ""}</div>
      <article>${body}</article>
    </main>
    <aside class="inspector">
      <p class="eyebrow">Inspector</p>
      <section><h2>On this page</h2><nav class="toc">${headings.map((heading, index) => `<a href="#${escapeHtml(headingId(heading.value, document.ast.blocks.indexOf(heading)))}">${escapeHtml(heading.value)}</a>`).join("") || `<p class="empty">No headings</p>`}</nav></section>
      <section><h2>Outgoing</h2>${relationshipList(project, outgoing, "outgoing", hrefFor)}</section>
      <section><h2>Used by</h2>${relationshipList(project, incoming, "incoming", hrefFor)}</section>
      <section><h2>Representations</h2><div class="representations"><a href="${escapeHtml(markdownHref)}">Markdown</a><a href="${escapeHtml(jsonHref)}">JSON</a></div></section>
      <section><h2>Diagnostics</h2>${documentDiagnostics.map((item) => `<div class="diagnostic"><strong>${escapeHtml(item.code)} · ${escapeHtml(item.severity)}</strong>${escapeHtml(item.message)}<br>${item.source.line}:${item.source.column}</div>`).join("") || `<p class="empty">No diagnostics</p>`}</section>
    </aside>
  </div>
</body>
</html>`;
}

function graphGeometry(documents: KnowledgeDocument[]): {
  height: number;
  positions: Map<string, { x: number; y: number }>;
  width: number;
} {
  const columns = Math.max(1, Math.ceil(Math.sqrt(documents.length)));
  const rows = Math.max(1, Math.ceil(documents.length / columns));
  const positions = new Map<string, { x: number; y: number }>();
  documents.forEach((document, index) => {
    positions.set(document.id, { x: 150 + (index % columns) * 270, y: 110 + Math.floor(index / columns) * 180 });
  });
  return { width: Math.max(520, columns * 270 + 30), height: Math.max(520, rows * 180 + 70), positions };
}

function graphSvg(project: KnowledgeProject, edges: KnowledgeEdge[], hrefFor: (document: KnowledgeDocument) => string): string {
  const documents = [...project.documents].sort((left, right) => left.path.localeCompare(right.path));
  const geometry = graphGeometry(documents);
  const parallelCounts = new Map<string, number>();
  const paths = edges.map((edge) => {
    const from = geometry.positions.get(edge.from);
    const to = geometry.positions.get(edge.to);
    if (!from || !to) return "";
    const key = `${edge.from}:${edge.to}`;
    const parallel = parallelCounts.get(key) ?? 0;
    parallelCounts.set(key, parallel + 1);
    const offset = (parallel - (edges.filter((item) => item.from === edge.from && item.to === edge.to).length - 1) / 2) * 34;
    const middleX = (from.x + to.x) / 2;
    const middleY = (from.y + to.y) / 2 + offset;
    return `<path class="graph-edge ${escapeHtml(edge.type)}" d="M ${from.x} ${from.y} Q ${middleX} ${middleY} ${to.x} ${to.y}" marker-end="url(#arrow)"><title>${escapeHtml(`${edge.type}: ${edge.from} → ${edge.to}`)}</title></path><text class="edge-label" x="${middleX}" y="${middleY - 7}">${escapeHtml(edge.type)}</text>`;
  }).join("");
  const nodes = documents.map((document) => {
    const position = geometry.positions.get(document.id)!;
    const title = document.title.length > 24 ? `${document.title.slice(0, 23)}…` : document.title;
    return `<a class="graph-node" href="${escapeHtml(hrefFor(document))}"><title>${escapeHtml(document.title)} · ${escapeHtml(document.path)}</title><rect x="${position.x - 95}" y="${position.y - 35}" width="190" height="70" rx="10"></rect><text class="node-title" x="${position.x - 78}" y="${position.y - 4}">${escapeHtml(title)}</text><text class="node-meta" x="${position.x - 78}" y="${position.y + 16}">${escapeHtml(`${document.type} · ${document.status}`)}</text></a>`;
  }).join("");
  return `<svg viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-label="${escapeHtml(project.title)} knowledge graph"><defs><marker id="arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="3"><path d="M0,0 L0,6 L8,3 z" fill="#657068"></path></marker></defs>${paths}${nodes}</svg>`;
}

export function renderGraphPage(
  project: KnowledgeProject,
  diagnostics: Diagnostic[] = [],
  options: GraphRenderOptions = {},
): string {
  const hrefFor = options.documentHref ?? ((target) => documentRoute(project, target));
  const graphHref = options.graphHref ?? `/p/${encodeURIComponent(project.slug)}/graph`;
  const relation = options.relation ?? "all";
  const graphEdges = project.graph.edges.filter((edge) => edge.type !== "contains" && (relation === "all" || edge.type === relation));
  const filters = (["all", "imports", "embeds", "references", "mentions"] as const).map((value) => `<a class="${value === relation ? "active" : ""}" href="${escapeHtml(`${graphHref}?relation=${value}`)}">${value === "all" ? "All relations" : value}</a>`).join("");
  const count = (type: KnowledgeEdge["type"]): number => project.graph.edges.filter((edge) => edge.type === type).length;
  const sourceActions = options.sourceHref ? project.documents.map((document) => `<div class="relationship"><span>${escapeHtml(document.title)}</span><a class="source-action" href="${escapeHtml(options.sourceHref!(document))}">Open in Obsidian</a></div>`).join("") : "";
  return `<!doctype html>
<html lang="${escapeHtml(project.config.project.language ?? "en")}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Graph · ${escapeHtml(project.title)}</title><style>${stylesheet(options.theme)}</style></head>
<body>
  <header class="topbar"><a class="brand" href="${escapeHtml(options.homeHref ?? `/p/${encodeURIComponent(project.slug)}`)}">Knotdown</a><span class="project-title">${escapeHtml(project.title)}</span><nav class="view-nav" aria-label="Knowledge Browser views"><a href="${escapeHtml(options.homeHref ?? `/p/${encodeURIComponent(project.slug)}`)}">Human</a><a class="active" href="${escapeHtml(graphHref)}">Graph</a><a href="${escapeHtml(options.agentHref ?? `/p/${encodeURIComponent(project.slug)}/agent`)}">Agent</a></nav><span class="build">build ${escapeHtml(project.buildId.slice(0, 12))}</span></header>
  <div class="graph-layout">
    <main class="graph-main">
      <div class="graph-heading"><div><p class="eyebrow">Graph View</p><h1>Project relationships</h1><p>Nodes and typed edges from the current compiler build.</p></div><nav class="filters" aria-label="Edge type filters">${filters}</nav></div>
      <div class="graph-canvas">${graphSvg(project, graphEdges, hrefFor)}</div>
    </main>
    <aside class="graph-inspector">
      <p class="eyebrow">Graph inspector</p>
      <section><h2>Build totals</h2><div class="stat-grid"><div class="stat"><strong>${project.documents.length}</strong><span>Documents</span></div><div class="stat"><strong>${graphEdges.length}</strong><span>Visible edges</span></div><div class="stat"><strong>${count("imports")}</strong><span>Imports</span></div><div class="stat"><strong>${count("embeds")}</strong><span>Embeds</span></div><div class="stat"><strong>${count("references")}</strong><span>References</span></div><div class="stat"><strong>${count("mentions")}</strong><span>Mentions</span></div><div class="stat"><strong>${diagnostics.length}</strong><span>Diagnostics</span></div></div></section>
      <section><h2>Legend</h2><div class="legend"><span><i class="imports"></i>Imports</span><span><i class="embeds"></i>Embeds</span><span><i class="references"></i>References</span><span><i class="mentions"></i>Mentions (weak)</span></div></section>
      <section><h2>Scope</h2><p class="empty">Only nodes from <strong>${escapeHtml(project.slug)}</strong> are shown. Select a node to open its Human View.</p></section>
      ${sourceActions ? `<section><h2>Source notes</h2>${sourceActions}</section>` : ""}
    </aside>
  </div>
</body>
</html>`;
}

export function renderAgentPage(
  project: KnowledgeProject,
  context?: ContextPack,
  explanation?: ContextExplanation,
  options: AgentRenderOptions = {},
): string {
  const homeHref = options.homeHref ?? `/p/${encodeURIComponent(project.slug)}`;
  const graphHref = options.graphHref ?? `${homeHref}/graph`;
  const agentHref = options.agentHref ?? `${homeHref}/agent`;
  const hrefFor = options.documentHref ?? ((target: KnowledgeDocument) => documentRoute(project, target));
  const selectedEntrypoint = options.entrypoint ?? project.documents[0]?.path ?? "";
  const query = options.query ?? "";
  const tokenBudget = options.tokenBudget ?? project.config.retrieval.default_token_budget;
  const depth = options.depth ?? project.config.retrieval.default_depth;
  const decisions = explanation?.decisions.map((decision) => {
    const document = project.documents.find((item) => item.id === decision.documentId);
    const title = document?.title ?? decision.documentId;
    const detail = decision.decision === "included"
      ? `${decision.representation ?? "unknown"} · ${decision.tokens ?? 0} tokens · ${decision.reason}`
      : `${decision.exclusionReason ?? "excluded"} · ${decision.reason}`;
    const label = document ? `<a href="${escapeHtml(hrefFor(document))}">${escapeHtml(title)}</a>${options.sourceHref ? `<a class="decision-source" href="${escapeHtml(options.sourceHref(document))}">Open in Obsidian</a>` : ""}` : escapeHtml(title);
    return `<div class="decision ${decision.decision}"><strong>${label}</strong><small>${escapeHtml(decision.decision)} · ${escapeHtml(detail)}</small><small>${escapeHtml(decision.path.join(" → "))}</small></div>`;
  }).join("") ?? "";
  return `<!doctype html>
<html lang="${escapeHtml(project.config.project.language ?? "en")}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent · ${escapeHtml(project.title)}</title><style>${stylesheet(options.theme)}</style></head>
<body>
  <header class="topbar"><a class="brand" href="${escapeHtml(homeHref)}">Knotdown</a><span class="project-title">${escapeHtml(project.title)}</span><nav class="view-nav" aria-label="Knowledge Browser views"><a href="${escapeHtml(homeHref)}">Human</a><a href="${escapeHtml(graphHref)}">Graph</a><a class="active" href="${escapeHtml(agentHref)}">Agent</a></nav><span class="build">build ${escapeHtml(project.buildId.slice(0, 12))}</span></header>
  <div class="agent-layout">
    <aside class="agent-controls">
      <p class="eyebrow">Agent View</p><h1>Context debugger</h1><p>Build the same deterministic context pack exposed through the Agent API. Every inclusion and exclusion remains inspectable.</p>
      <form class="agent-form" action="${escapeHtml(agentHref)}" method="get">
        <label>Entrypoint<select name="entry">${project.documents.map((document) => `<option value="${escapeHtml(document.path)}"${document.path === selectedEntrypoint ? " selected" : ""}>${escapeHtml(document.title)} · ${escapeHtml(document.path)}</option>`).join("")}</select></label>
        <label>Query<input name="q" required value="${escapeHtml(query)}" placeholder="What should the agent understand?"></label>
        <label>Token budget<input name="budget" type="number" min="1" value="${tokenBudget}"></label>
        <label>Graph depth<input name="depth" type="number" min="0" max="${project.config.retrieval.max_depth}" value="${depth}"></label>
        <button type="submit">Build context</button>
      </form>
    </aside>
    <main class="agent-result">
      <p class="eyebrow">Shared runtime result</p><h1>${context ? "Context pack" : "Run a context request"}</h1>
      ${options.error ? `<div class="agent-error">${escapeHtml(options.error)}</div>` : ""}
      ${context ? `<div class="agent-stats"><span>${context.items.length} included</span><span>${context.excluded.length} excluded</span><span>${context.estimatedTokens} / ${context.tokenBudget} tokens</span><span>build ${escapeHtml(context.buildId.slice(0, 12))}</span></div><div class="decision-list">${decisions || `<p class="empty">No candidate documents.</p>`}</div><button class="copy-context" id="copy-context" type="button">Copy context</button><pre class="context-output" id="context-output">${escapeHtml(context.content)}</pre>` : `<p>Choose an entrypoint and query to inspect exactly what an agent receives and why.</p>`}
    </main>
  </div>
  ${options.scriptHref ? `<script src="${escapeHtml(options.scriptHref)}" defer></script>` : ""}
</body>
</html>`;
}

export function renderDiagnosticsPage(title: string, diagnostics: Diagnostic[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${stylesheet()}</style></head><body><header class="topbar"><span class="brand">Knotdown</span><span class="project-title">Compiler diagnostics</span></header><main class="error-page"><p class="eyebrow">Knowledge Browser</p><h1>${escapeHtml(title)}</h1>${diagnostics.map((item) => `<div class="diagnostic"><strong>${escapeHtml(item.code)} · ${escapeHtml(item.severity)}</strong>${escapeHtml(item.message)}<br><code>${escapeHtml(item.source.path)}:${item.source.line}:${item.source.column}</code></div>`).join("") || "<p>No documents were found.</p>"}</main></body></html>`;
}
