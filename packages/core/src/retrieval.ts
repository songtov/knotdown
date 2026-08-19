import type {
  KnowledgeDocument,
  KnowledgeProject,
  SearchMatchKind,
} from "./types.ts";
import { normalizeLabel, toPosix } from "./util.ts";

export interface RankedDocument {
  document: KnowledgeDocument;
  score: number;
  matches: SearchMatchKind[];
}

const matchOrder: SearchMatchKind[] = ["id", "path", "title", "alias", "import_label", "summary", "body"];

function addMatch(matches: Set<SearchMatchKind>, kind: SearchMatchKind, score: number): number {
  matches.add(kind);
  return score;
}

export function rankDocuments(project: KnowledgeProject, query: string): RankedDocument[] {
  const normalizedQuery = normalizeLabel(query);
  if (!normalizedQuery) return [];
  const terms = normalizedQuery.split(/\s+/u).filter(Boolean);
  const ranked: RankedDocument[] = [];

  for (const document of project.documents) {
    const matches = new Set<SearchMatchKind>();
    const normalizedPath = normalizeLabel(toPosix(document.path));
    const normalizedTitle = normalizeLabel(document.title);
    const normalizedAliases = document.aliases.map(normalizeLabel);
    const normalizedImports = document.imports.map((binding) => binding.normalizedLabel);
    const normalizedSummary = normalizeLabel(document.summary);
    const normalizedBody = normalizeLabel(document.body);
    let score = 0;

    if (document.id === query) score += addMatch(matches, "id", 1000);
    if (normalizedPath === normalizedQuery) score += addMatch(matches, "path", 900);
    if (normalizedTitle === normalizedQuery) score += addMatch(matches, "title", 800);
    if (normalizedAliases.includes(normalizedQuery)) score += addMatch(matches, "alias", 750);
    if (normalizedImports.includes(normalizedQuery)) score += addMatch(matches, "import_label", 700);

    for (const term of terms) {
      if (normalizedTitle.includes(term)) score += addMatch(matches, "title", 40);
      if (normalizedAliases.some((alias) => alias.includes(term))) score += addMatch(matches, "alias", 35);
      if (normalizedImports.some((label) => label.includes(term))) score += addMatch(matches, "import_label", 30);
      if (normalizedSummary.includes(term)) score += addMatch(matches, "summary", 20);
      if (normalizedBody.includes(term)) score += addMatch(matches, "body", 10);
      if (normalizedPath.includes(term)) score += addMatch(matches, "path", 5);
    }

    if (score > 0) {
      ranked.push({
        document,
        score,
        matches: matchOrder.filter((kind) => matches.has(kind)),
      });
    }
  }

  return ranked.sort((left, right) => right.score - left.score || left.document.path.localeCompare(right.document.path));
}

export function resolveDocument(project: KnowledgeProject, identifier: string): KnowledgeDocument | undefined {
  const normalized = normalizeLabel(toPosix(identifier).replace(/^\.\//u, ""));
  const exact = project.documents.find((document) => document.id === identifier || normalizeLabel(document.path) === normalized);
  if (exact) return exact;
  const named = project.documents.filter((document) => normalizeLabel(document.title) === normalized || document.aliases.some((alias) => normalizeLabel(alias) === normalized));
  return named.length === 1 ? named[0] : undefined;
}
