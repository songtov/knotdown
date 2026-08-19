export type Severity = "error" | "warning";
export type DocumentStatus = "draft" | "stable" | "deprecated";
export type EdgeStrength = "strong" | "medium" | "weak";
export type EdgeType = "contains" | "imports" | "references" | "embeds" | "mentions";

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
  offset?: number;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  source: SourceLocation;
}

export interface ProjectConfig {
  spec: "0.1";
  project: {
    id: string;
    slug: string;
    title: string;
    language?: string;
  };
  content: {
    roots: string[];
    include: string[];
    exclude: string[];
    dialect: "standard" | "obsidian";
  };
  identity: {
    strategy: "uuidv7";
    require_document_id: boolean;
  };
  imports: {
    allow_outside_project: false;
    allow_symlink_escape: false;
    warn_unused: boolean;
  };
  mentions: {
    enabled: boolean;
    mode: "imported-labels";
    strength: "weak";
    mutate_source: false;
  };
  retrieval: {
    default_depth: number;
    max_depth: number;
    default_token_budget: number;
    max_documents: number;
    semantic_search: "disabled" | "optional";
  };
  build: {
    output: string;
    emit: string[];
  };
  server: {
    host: "127.0.0.1";
    port: number;
  };
}

export interface Frontmatter {
  id?: string;
  type?: string;
  status?: DocumentStatus;
  summary?: string;
  aliases?: string[];
  [key: string]: unknown;
}

export interface InlineTextNode {
  type: "text";
  value: string;
  location: SourceLocation;
}

export interface InlineCodeNode {
  type: "code";
  value: string;
  location: SourceLocation;
}

export interface InlineReferenceNode {
  type: "reference";
  label: string;
  display: string;
  location: SourceLocation;
}

export interface InlineLinkNode {
  type: "link";
  display: string;
  destination: string;
  location: SourceLocation;
}

export interface InlineWikiLinkNode {
  type: "wikilink";
  target: string;
  display: string;
  embed: boolean;
  location: SourceLocation;
}

export type InlineNode = InlineTextNode | InlineCodeNode | InlineReferenceNode | InlineLinkNode | InlineWikiLinkNode;

export interface HeadingNode {
  type: "heading";
  depth: number;
  value: string;
  inlines: InlineNode[];
  location: SourceLocation;
}

export interface ParagraphNode {
  type: "paragraph";
  value: string;
  inlines: InlineNode[];
  location: SourceLocation;
}

export interface DefinitionNode {
  type: "definition";
  label: string;
  destination: string;
  location: SourceLocation;
}

export interface CodeBlockNode {
  type: "code_block";
  value: string;
  location: SourceLocation;
}

export type MarkdownBlock = HeadingNode | ParagraphNode | DefinitionNode | CodeBlockNode;

export interface MarkdownAst {
  type: "document";
  blocks: MarkdownBlock[];
}

export interface ParsedMarkdown {
  frontmatter: Frontmatter;
  ast: MarkdownAst;
  body: string;
  bodyStartLine: number;
}

export interface ImportBinding {
  label: string;
  normalizedLabel: string;
  targetId: string;
  targetPath: string;
  fragment?: string;
  sourceLocation: SourceLocation;
}

export interface ReferenceUse {
  label: string;
  targetId: string;
  targetPath: string;
  sourceLocation: SourceLocation;
}

export interface WikiLinkUse {
  target: string;
  display: string;
  targetId: string;
  targetPath: string;
  fragment?: string;
  embed: boolean;
  sourceLocation: SourceLocation;
}

export interface ImplicitMention {
  label: string;
  targetId: string;
  targetPath: string;
  confidence: number;
  sourceLocation: SourceLocation;
}

export interface KnowledgeDocument {
  id: string;
  projectId: string;
  type: string;
  status: DocumentStatus;
  path: string;
  absolutePath: string;
  canonicalPath: string;
  title: string;
  summary: string;
  aliases: string[];
  raw: string;
  body: string;
  ast: MarkdownAst;
  imports: ImportBinding[];
  references: ReferenceUse[];
  wikilinks: WikiLinkUse[];
  embeds: WikiLinkUse[];
  mentions: ImplicitMention[];
  tokenEstimate: number;
  sourceHash: string;
}

export interface KnowledgeNode {
  id: string;
  project_id: string;
  kind: "project" | "document" | "external_source";
  title: string;
  path?: string;
  document_type?: string;
  status?: DocumentStatus;
  summary?: string;
}

export interface KnowledgeEdge {
  id: string;
  project_id: string;
  from: string;
  to: string;
  type: EdgeType;
  strength: EdgeStrength;
  origin: string;
  label?: string;
  source: SourceLocation;
}

export interface KnowledgeGraph {
  project_id: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface KnowledgeProject {
  id: string;
  slug: string;
  title: string;
  root: string;
  config: ProjectConfig;
  documents: KnowledgeDocument[];
  graph: KnowledgeGraph;
  sourceHash: string;
  buildId: string;
}

export interface CompileResult {
  project?: KnowledgeProject;
  diagnostics: Diagnostic[];
  hasErrors: boolean;
}

export type ContextRepresentation = "full" | "summary" | "metadata";

export interface ContextRequest {
  projectId: string;
  query: string;
  entrypoint?: string;
  depth?: number;
  tokenBudget?: number;
  maxDocuments?: number;
  relations?: EdgeType[];
}

export interface ContextItem {
  documentId: string;
  sourcePath: string;
  representation: ContextRepresentation;
  reason: string;
  path: string[];
  tokens: number;
  content: string;
}

export interface ContextExclusion {
  documentId: string;
  sourcePath: string;
  reason: "token_budget" | "depth_limit" | "document_limit";
  candidateReason: string;
  path: string[];
}

export interface ContextPack {
  buildId: string;
  projectId: string;
  query: string;
  tokenBudget: number;
  estimatedTokens: number;
  items: ContextItem[];
  excluded: ContextExclusion[];
  content: string;
}

export type SearchMatchKind = "id" | "path" | "title" | "alias" | "import_label" | "summary" | "body";

export interface SearchKnowledgeRequest {
  projectId: string;
  query: string;
  limit?: number;
}

export interface SearchKnowledgeItem {
  documentId: string;
  sourcePath: string;
  title: string;
  summary: string;
  documentType: string;
  status: DocumentStatus;
  score: number;
  matches: SearchMatchKind[];
}

export interface SearchKnowledgeResult {
  buildId: string;
  projectId: string;
  query: string;
  items: SearchKnowledgeItem[];
}

export interface ReadDocumentRequest {
  projectId: string;
  document: string;
  representation?: ContextRepresentation;
}

export interface ReadDocumentResult {
  buildId: string;
  projectId: string;
  documentId: string;
  sourcePath: string;
  title: string;
  summary: string;
  documentType: string;
  status: DocumentStatus;
  aliases: string[];
  representation: ContextRepresentation;
  tokenEstimate: number;
  content: string;
  outgoing: KnowledgeEdge[];
  incoming: KnowledgeEdge[];
}

export type TraverseDirection = "outgoing" | "incoming" | "both";

export interface TraverseGraphRequest {
  projectId: string;
  start: string;
  direction?: TraverseDirection;
  relations?: EdgeType[];
  depth?: number;
  maxDocuments?: number;
}

export interface TraversalNode {
  documentId: string;
  sourcePath: string;
  title: string;
  depth: number;
  reason: string;
  path: string[];
}

export interface TraverseGraphResult {
  buildId: string;
  projectId: string;
  startDocumentId: string;
  direction: TraverseDirection;
  relations: EdgeType[];
  nodes: TraversalNode[];
  edges: KnowledgeEdge[];
  truncated: boolean;
}

export interface ContextDecision {
  documentId: string;
  sourcePath: string;
  decision: "included" | "excluded";
  reason: string;
  path: string[];
  representation?: ContextRepresentation;
  tokens?: number;
  exclusionReason?: ContextExclusion["reason"];
}

export interface ContextExplanation {
  buildId: string;
  projectId: string;
  query: string;
  tokenBudget: number;
  estimatedTokens: number;
  decisions: ContextDecision[];
}
