import type { KnowledgeDocument, KnowledgeProject } from "../../core/src/index.ts";

const LANDING_TITLES = new Set(["home", "overview", "start here", "welcome"]);

export function selectLandingDocument(project: KnowledgeProject): KnowledgeDocument | undefined {
  return project.documents.find((document) => LANDING_TITLES.has(document.title.trim().toLocaleLowerCase("und")))
    ?? project.documents.find((document) => document.type === "guide")
    ?? project.documents[0];
}
