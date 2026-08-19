import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { loadProjectConfig } from "./config.ts";
import { loadIdentitySidecar } from "./identity.ts";
import { blockPlainText, parseMarkdown } from "./markdown.ts";
import type {
  CompileResult,
  Diagnostic,
  EdgeType,
  ImplicitMention,
  ImportBinding,
  InlineNode,
  KnowledgeDocument,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNode,
  ProjectConfig,
  ReferenceUse,
  SourceLocation,
  WikiLinkUse,
} from "./types.ts";
import {
  CORE_VERSION,
  diagnostic,
  estimateTokens,
  isUuid,
  isWithin,
  normalizeLabel,
  relativePosix,
  sha256,
  sortDiagnostics,
  stableJson,
  toPosix,
} from "./util.ts";
import { YamlParseError } from "./yaml.ts";

interface DiscoveredFile {
  absolutePath: string;
  canonicalPath: string;
  projectPath: string;
}

function globRegex(pattern: string): RegExp {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        index += 1;
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else source += ".*";
      } else source += "[^/]*";
    } else if (character === "?") source += "[^/]";
    else source += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
  }
  return new RegExp(`${source}$`, "u");
}

function matches(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globRegex(toPosix(pattern)).test(pathname));
}

async function discoverDocuments(root: string, config: ProjectConfig, diagnostics: Diagnostic[]): Promise<{ files: DiscoveredFile[]; contentRoots: string[] }> {
  const files: DiscoveredFile[] = [];
  const contentRoots: string[] = [];
  const seenCanonicalFiles = new Set<string>();
  const visit = async (directory: string, logicalRoot: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const projectPath = relativePosix(root, absolute);
      if (matches(projectPath, config.content.exclude)) continue;
      if (entry.isDirectory()) {
        await visit(absolute, logicalRoot);
        continue;
      }
      let fileLike = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          fileLike = (await stat(absolute)).isFile();
        } catch {
          fileLike = false;
        }
      }
      if (!fileLike || path.extname(entry.name).toLowerCase() !== ".md" || !matches(projectPath, config.content.include)) continue;
      const canonical = await realpath(absolute);
      if (!isWithin(root, canonical) || !isWithin(logicalRoot, canonical)) {
        diagnostics.push(diagnostic("KB202", "error", `Discovered Markdown symlink escapes its content root: ${projectPath}`, { path: projectPath, line: 1, column: 1 }));
        continue;
      }
      if (seenCanonicalFiles.has(canonical)) continue;
      seenCanonicalFiles.add(canonical);
      files.push({ absolutePath: absolute, canonicalPath: canonical, projectPath });
    }
  };
  for (const configuredRoot of config.content.roots) {
    const absolute = path.resolve(root, configuredRoot);
    if (!isWithin(root, absolute)) {
      diagnostics.push(diagnostic("KB001", "error", `Content root escapes the project: ${configuredRoot}`, { path: ".knowledge/project.yaml", line: 1, column: 1 }));
      continue;
    }
    try {
      const canonical = await realpath(absolute);
      if (!isWithin(root, canonical)) {
        diagnostics.push(diagnostic("KB202", "error", `Content root symlink escapes the project: ${configuredRoot}`, { path: ".knowledge/project.yaml", line: 1, column: 1 }));
        continue;
      }
      if (!(await lstat(canonical)).isDirectory()) throw new Error("not a directory");
      contentRoots.push(canonical);
      await visit(absolute, canonical);
    } catch {
      diagnostics.push(diagnostic("KB001", "error", `Content root does not exist or is not readable: ${configuredRoot}`, { path: ".knowledge/project.yaml", line: 1, column: 1 }));
    }
  }
  files.sort((a, b) => a.projectPath.localeCompare(b.projectPath));
  return { files, contentRoots };
}

function titleAndSummary(rawSummary: unknown, ast: KnowledgeDocument["ast"], fallbackPath: string): { title: string; summary: string } {
  const heading = ast.blocks.find((block) => block.type === "heading" && block.depth === 1);
  const title = heading ? blockPlainText(heading).trim() : path.basename(fallbackPath, path.extname(fallbackPath));
  const paragraph = ast.blocks.find((block) => block.type === "paragraph");
  const generated = paragraph ? blockPlainText(paragraph).replace(/\s+/gu, " ").trim() : "";
  return { title, summary: typeof rawSummary === "string" && rawSummary.trim() ? rawSummary.trim() : generated };
}

function documentParseDiagnostic(file: DiscoveredFile, error: unknown): Diagnostic {
  const line = error instanceof YamlParseError ? error.line + 1 : 1;
  return diagnostic("KB401", "error", `Cannot parse document: ${error instanceof Error ? error.message : String(error)}`, { path: file.projectPath, line, column: 1 });
}

function splitDestination(destination: string): { file: string; fragment?: string } {
  const hash = destination.indexOf("#");
  if (hash < 0) return { file: destination };
  return { file: destination.slice(0, hash), fragment: destination.slice(hash + 1) };
}

function splitWikiTarget(target: string): { file: string; fragment?: string } {
  const hash = target.indexOf("#");
  if (hash < 0) return { file: target.trim() };
  return { file: target.slice(0, hash).trim(), fragment: target.slice(hash + 1).trim() };
}

function withoutMarkdownExtension(value: string): string {
  return toPosix(value).replace(/\.md$/iu, "").replace(/^\.\//u, "");
}

function uniqueDocuments(documents: KnowledgeDocument[]): KnowledgeDocument[] {
  return [...new Map(documents.map((document) => [document.path, document])).values()];
}

function resolveWikiTarget(
  root: string,
  source: KnowledgeDocument,
  rawTarget: string,
  documents: KnowledgeDocument[],
): { target?: KnowledgeDocument; fragment?: string; boundaryEscape?: boolean; ambiguous?: boolean } {
  const destination = splitWikiTarget(rawTarget);
  if (!destination.file) return { target: source, ...(destination.fragment ? { fragment: destination.fragment } : {}) };
  const byId = documents.find((document) => document.id === destination.file);
  if (byId) return { target: byId, ...(destination.fragment ? { fragment: destination.fragment } : {}) };

  const requested = withoutMarkdownExtension(destination.file);
  const explicitPath = destination.file.includes("/") || destination.file.includes("\\") || destination.file.startsWith(".");
  let candidates: KnowledgeDocument[] = [];
  if (explicitPath) {
    const values = destination.file.startsWith("/")
      ? [path.resolve(root, `.${destination.file}`)]
      : destination.file.startsWith(".")
        ? [path.resolve(path.dirname(source.absolutePath), destination.file)]
        : [path.resolve(path.dirname(source.absolutePath), destination.file), path.resolve(root, destination.file)];
    if (values.some((candidate) => !isWithin(root, candidate))) return { boundaryEscape: true };
    const paths = new Set(values.flatMap((candidate) => {
      const projectPath = relativePosix(root, candidate);
      return [withoutMarkdownExtension(projectPath), withoutMarkdownExtension(`${projectPath}.md`)];
    }));
    candidates = documents.filter((document) => paths.has(withoutMarkdownExtension(document.path)));
  } else {
    const normalized = normalizeLabel(requested);
    candidates = documents.filter((document) => {
      const basename = path.posix.basename(withoutMarkdownExtension(document.path));
      return normalizeLabel(basename) === normalized
        || normalizeLabel(document.title) === normalized
        || document.aliases.some((alias) => normalizeLabel(alias) === normalized);
    });
  }
  const unique = uniqueDocuments(candidates);
  if (unique.length > 1) return { ambiguous: true };
  return { target: unique[0], ...(destination.fragment ? { fragment: destination.fragment } : {}) };
}

function isExternalDestination(destination: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(destination) || destination.startsWith("//");
}

function internalContentPath(contentRoots: string[], candidate: string): boolean {
  return contentRoots.some((root) => isWithin(root, candidate));
}

function allInlineNodes(document: KnowledgeDocument): InlineNode[] {
  return document.ast.blocks.flatMap((block) => block.type === "heading" || block.type === "paragraph" ? block.inlines : []);
}

function asciiIdentifier(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/u.test(value);
}

function isIdentifierCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

function extractMentions(document: KnowledgeDocument): ImplicitMention[] {
  const bindings = [...document.imports].sort((a, b) => b.normalizedLabel.length - a.normalizedLabel.length || a.normalizedLabel.localeCompare(b.normalizedLabel));
  const mentions: ImplicitMention[] = [];
  for (const node of allInlineNodes(document)) {
    if (node.type !== "text" || node.value === "\n") continue;
    const normalizedText = node.value.normalize("NFC").toLocaleLowerCase("und");
    let cursor = 0;
    while (cursor < normalizedText.length) {
      let matched: ImportBinding | undefined;
      for (const binding of bindings) {
        if (!normalizedText.startsWith(binding.normalizedLabel, cursor)) continue;
        if (asciiIdentifier(binding.normalizedLabel)) {
          const before = cursor > 0 ? normalizedText[cursor - 1] : undefined;
          const after = normalizedText[cursor + binding.normalizedLabel.length];
          if (isIdentifierCharacter(before) || isIdentifierCharacter(after)) continue;
        }
        matched = binding;
        break;
      }
      if (!matched) {
        cursor += 1;
        continue;
      }
      mentions.push({
        label: matched.label,
        targetId: matched.targetId,
        targetPath: matched.targetPath,
        confidence: 0.5,
        sourceLocation: {
          path: document.path,
          line: node.location.line,
          column: node.location.column + cursor,
          ...(node.location.offset === undefined ? {} : { offset: node.location.offset + cursor }),
        },
      });
      cursor += matched.normalizedLabel.length;
    }
  }
  return mentions;
}

function edgeId(projectId: string, from: string, to: string, type: EdgeType, origin: string, source: SourceLocation): string {
  return sha256([projectId, from, to, type, origin, source.path, source.line, source.column].join("\u001f")).slice(0, 24);
}

function makeEdge(projectId: string, from: string, to: string, type: EdgeType, strength: KnowledgeEdge["strength"], origin: string, source: SourceLocation, label?: string): KnowledgeEdge {
  return {
    id: edgeId(projectId, from, to, type, origin, source),
    project_id: projectId,
    from,
    to,
    type,
    strength,
    origin,
    ...(label === undefined ? {} : { label }),
    source,
  };
}

function buildGraph(projectId: string, projectTitle: string, documents: KnowledgeDocument[]): KnowledgeGraph {
  const nodes: KnowledgeNode[] = [
    { id: projectId, project_id: projectId, kind: "project", title: projectTitle },
    ...documents.filter((document) => document.id).map((document) => ({
      id: document.id,
      project_id: projectId,
      kind: "document" as const,
      title: document.title,
      path: document.path,
      document_type: document.type,
      status: document.status,
      summary: document.summary,
    })),
  ];
  const edges: KnowledgeEdge[] = [];
  for (const document of documents.filter((item) => item.id)) {
    edges.push(makeEdge(projectId, projectId, document.id, "contains", "strong", "project_membership", { path: document.path, line: 1, column: 1 }));
    for (const binding of document.imports) edges.push(makeEdge(projectId, document.id, binding.targetId, "imports", "strong", "markdown_reference_definition", binding.sourceLocation, binding.label));
    for (const reference of document.references) edges.push(makeEdge(projectId, document.id, reference.targetId, "references", "strong", "explicit_reference_use", reference.sourceLocation, reference.label));
    for (const wikilink of document.wikilinks) edges.push(makeEdge(projectId, document.id, wikilink.targetId, "references", "strong", "obsidian_wikilink", wikilink.sourceLocation, wikilink.display));
    for (const embed of document.embeds) edges.push(makeEdge(projectId, document.id, embed.targetId, "embeds", "strong", "obsidian_embed", embed.sourceLocation, embed.display));
    for (const mention of document.mentions) edges.push(makeEdge(projectId, document.id, mention.targetId, "mentions", "weak", "implicit_imported_label", mention.sourceLocation, mention.label));
  }
  const uniqueEdges = [...new Map(edges.map((edge) => [edge.id, edge])).values()];
  nodes.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  uniqueEdges.sort((a, b) => a.from.localeCompare(b.from)
    || a.to.localeCompare(b.to)
    || a.type.localeCompare(b.type)
    || a.source.path.localeCompare(b.source.path)
    || a.source.line - b.source.line
    || a.source.column - b.source.column
    || a.id.localeCompare(b.id));
  return { project_id: projectId, nodes, edges: uniqueEdges };
}

export async function compileProject(inputRoot = process.cwd()): Promise<CompileResult> {
  const loaded = await loadProjectConfig(inputRoot);
  const diagnostics = [...loaded.diagnostics];
  if (!loaded.config) return { diagnostics: sortDiagnostics(diagnostics), hasErrors: true };
  let identityDocuments: Record<string, string> = {};
  if (!loaded.config.identity.require_document_id) {
    try {
      identityDocuments = (await loadIdentitySidecar(loaded.root)).documents;
    } catch (error) {
      diagnostics.push(diagnostic("KB103", "error", `Cannot read identity sidecar: ${error instanceof Error ? error.message : String(error)}`, { path: ".knowledge/identities.json", line: 1, column: 1 }));
    }
  }
  const { files, contentRoots } = await discoverDocuments(loaded.root, loaded.config, diagnostics);
  const documents: KnowledgeDocument[] = [];
  for (const file of files) {
    let raw: string;
    try {
      raw = await readFile(file.absolutePath, "utf8");
      const parsed = parseMarkdown(raw, file.projectPath, { frontmatterRequired: loaded.config.content.dialect !== "obsidian" });
      const frontmatter = parsed.frontmatter;
      const documentId = frontmatter.id ?? identityDocuments[file.projectPath];
      if (documentId === undefined) diagnostics.push(diagnostic("KB101", "error", loaded.config.identity.require_document_id ? "Document ID is required." : "Document needs a sidecar ID; run 'knotdown adopt'.", { path: file.projectPath, line: 1, column: 1 }));
      else if (!isUuid(documentId)) diagnostics.push(diagnostic("KB401", "error", "Document ID must be a UUID string.", { path: file.projectPath, line: 1, column: 1 }));
      if (loaded.config.content.dialect === "standard" && (typeof frontmatter.type !== "string" || !frontmatter.type.trim())) diagnostics.push(diagnostic("KB401", "error", "Document type is required.", { path: file.projectPath, line: 2, column: 1 }));
      const status = frontmatter.status ?? "draft";
      if (!(["draft", "stable", "deprecated"] as unknown[]).includes(status)) diagnostics.push(diagnostic("KB401", "error", "Document status must be draft, stable, or deprecated.", { path: file.projectPath, line: 2, column: 1 }));
      const aliases = frontmatter.aliases;
      if (aliases !== undefined && (!Array.isArray(aliases) || !aliases.every((item) => typeof item === "string"))) diagnostics.push(diagnostic("KB401", "error", "Document aliases must be a string sequence.", { path: file.projectPath, line: 2, column: 1 }));
      const metadata = titleAndSummary(frontmatter.summary, parsed.ast, file.projectPath);
      if (loaded.config.content.dialect === "standard" && !parsed.ast.blocks.some((block) => block.type === "heading" && block.depth === 1)) diagnostics.push(diagnostic("KB401", "error", "Document must have a level-one heading.", { path: file.projectPath, line: parsed.bodyStartLine, column: 1 }));
      documents.push({
        id: typeof documentId === "string" ? documentId : "",
        projectId: loaded.config.project.id,
        type: typeof frontmatter.type === "string" && frontmatter.type.trim() ? frontmatter.type : "note",
        status: (["draft", "stable", "deprecated"] as unknown[]).includes(status) ? status : "draft",
        path: file.projectPath,
        absolutePath: file.absolutePath,
        canonicalPath: file.canonicalPath,
        title: metadata.title,
        summary: metadata.summary,
        aliases: Array.isArray(aliases) ? aliases.filter((item): item is string => typeof item === "string") : [],
        raw,
        body: parsed.body,
        ast: parsed.ast,
        imports: [],
        references: [],
        wikilinks: [],
        embeds: [],
        mentions: [],
        tokenEstimate: estimateTokens(parsed.body),
        sourceHash: sha256(raw),
      });
    } catch (error) {
      diagnostics.push(documentParseDiagnostic(file, error));
    }
  }
  documents.sort((a, b) => a.path.localeCompare(b.path));
  const documentsById = new Map<string, KnowledgeDocument[]>();
  for (const document of documents) {
    if (!document.id) continue;
    const group = documentsById.get(document.id) ?? [];
    group.push(document);
    documentsById.set(document.id, group);
  }
  for (const [id, group] of documentsById) {
    if (group.length < 2) continue;
    for (const document of group) diagnostics.push(diagnostic("KB102", "error", `Duplicate document ID '${id}'.`, { path: document.path, line: 2, column: 1 }));
  }
  const documentsByCanonicalPath = new Map(documents.map((document) => [document.canonicalPath, document]));

  for (const document of documents) {
    const seenLabels = new Map<string, SourceLocation>();
    const bindingMap = new Map<string, ImportBinding>();
    const definitions = document.ast.blocks.filter((block) => block.type === "definition");
    for (const definition of definitions) {
      const normalizedLabel = normalizeLabel(definition.label);
      if (seenLabels.has(normalizedLabel)) {
        diagnostics.push(diagnostic("KB203", "error", `Duplicate local label '${definition.label}'.`, definition.location));
        continue;
      }
      seenLabels.set(normalizedLabel, definition.location);
      if (isExternalDestination(definition.destination)) continue;
      const destination = splitDestination(definition.destination);
      if (!destination.file.toLowerCase().endsWith(".md")) continue;
      const lexicalTarget = path.resolve(path.dirname(document.absolutePath), destination.file);
      if (!isWithin(loaded.root, lexicalTarget)) {
        diagnostics.push(diagnostic("KB202", "error", `Import escapes the project boundary: ${definition.destination}`, definition.location));
        continue;
      }
      let canonicalTarget: string;
      try {
        canonicalTarget = await realpath(lexicalTarget);
      } catch {
        diagnostics.push(diagnostic("KB201", "error", `Import target does not exist: ${definition.destination}`, definition.location));
        continue;
      }
      if (!isWithin(loaded.root, canonicalTarget) || !internalContentPath(contentRoots, canonicalTarget)) {
        diagnostics.push(diagnostic("KB202", "error", `Import target escapes the project content boundary: ${definition.destination}`, definition.location));
        continue;
      }
      const target = documentsByCanonicalPath.get(canonicalTarget);
      if (!target) {
        diagnostics.push(diagnostic("KB201", "error", `Import target is not a discovered Markdown document: ${definition.destination}`, definition.location));
        continue;
      }
      if (!target.id) continue;
      const binding: ImportBinding = {
        label: definition.label,
        normalizedLabel,
        targetId: target.id,
        targetPath: target.path,
        ...(destination.fragment ? { fragment: destination.fragment } : {}),
        sourceLocation: definition.location,
      };
      document.imports.push(binding);
      bindingMap.set(normalizedLabel, binding);
      if (destination.fragment) diagnostics.push(diagnostic("KB206", "warning", `Fragment import is unstable in v0.1: #${destination.fragment}`, definition.location));
      if (target.status === "deprecated") diagnostics.push(diagnostic("KB205", "warning", `Import targets deprecated document '${target.title}'.`, definition.location));
    }
    for (const node of allInlineNodes(document)) {
      if (node.type !== "reference") continue;
      const binding = bindingMap.get(normalizeLabel(node.label));
      if (!binding) continue;
      const reference: ReferenceUse = {
        label: binding.label,
        targetId: binding.targetId,
        targetPath: binding.targetPath,
        sourceLocation: node.location,
      };
      document.references.push(reference);
    }
    if (loaded.config.content.dialect === "obsidian") {
      for (const node of allInlineNodes(document)) {
        if (node.type !== "wikilink") continue;
        const resolved = resolveWikiTarget(loaded.root, document, node.target, documents);
        if (resolved.boundaryEscape) {
          diagnostics.push(diagnostic("KB202", "error", `Wikilink escapes the project boundary: ${node.target}`, node.location));
          continue;
        }
        if (resolved.ambiguous) {
          diagnostics.push(diagnostic("KB208", "error", `Ambiguous wikilink target '${node.target}'. Use a project-relative path.`, node.location));
          continue;
        }
        if (!resolved.target) {
          diagnostics.push(diagnostic("KB207", "error", `Wikilink target does not resolve inside this project: ${node.target}`, node.location));
          continue;
        }
        if (!resolved.target.id) continue;
        const use: WikiLinkUse = {
          target: node.target,
          display: node.display,
          targetId: resolved.target.id,
          targetPath: resolved.target.path,
          ...(resolved.fragment ? { fragment: resolved.fragment } : {}),
          embed: node.embed,
          sourceLocation: node.location,
        };
        if (node.embed) document.embeds.push(use);
        else document.wikilinks.push(use);
        if (resolved.target.status === "deprecated") diagnostics.push(diagnostic("KB205", "warning", `Wikilink targets deprecated document '${resolved.target.title}'.`, node.location));
      }
    }
    if (loaded.config.imports.warn_unused) {
      const usedLabels = new Set(document.references.map((reference) => normalizeLabel(reference.label)));
      for (const binding of document.imports) {
        if (!usedLabels.has(binding.normalizedLabel)) diagnostics.push(diagnostic("KB204", "warning", `Imported label '${binding.label}' is never explicitly referenced.`, binding.sourceLocation));
      }
    }
    if (loaded.config.mentions.enabled) document.mentions = extractMentions(document);
    document.imports.sort((a, b) => a.sourceLocation.line - b.sourceLocation.line || a.sourceLocation.column - b.sourceLocation.column || a.normalizedLabel.localeCompare(b.normalizedLabel));
    document.references.sort((a, b) => a.sourceLocation.line - b.sourceLocation.line || a.sourceLocation.column - b.sourceLocation.column);
    document.wikilinks.sort((a, b) => a.sourceLocation.line - b.sourceLocation.line || a.sourceLocation.column - b.sourceLocation.column);
    document.embeds.sort((a, b) => a.sourceLocation.line - b.sourceLocation.line || a.sourceLocation.column - b.sourceLocation.column);
    document.mentions.sort((a, b) => a.sourceLocation.line - b.sourceLocation.line || a.sourceLocation.column - b.sourceLocation.column || a.label.localeCompare(b.label));
  }

  const graph = buildGraph(loaded.config.project.id, loaded.config.project.title, documents);
  const normalizedConfig = stableJson(loaded.config).trimEnd();
  const sourceHash = sha256([normalizedConfig, ...documents.map((document) => `${document.path}\u001f${document.id}\u001f${document.sourceHash}`)].join("\u001f"));
  const buildId = sha256([CORE_VERSION, loaded.config.project.id, sourceHash].join("\u001f"));
  const sortedDiagnostics = sortDiagnostics(diagnostics);
  const project = {
    id: loaded.config.project.id,
    slug: loaded.config.project.slug,
    title: loaded.config.project.title,
    root: loaded.root,
    config: loaded.config,
    documents,
    graph,
    sourceHash,
    buildId,
  };
  return { project, diagnostics: sortedDiagnostics, hasErrors: sortedDiagnostics.some((item) => item.severity === "error") };
}
