import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createKnowledgeRuntime, stableJson } from "../../core/src/index.ts";
import type { CompileResult, KnowledgeDocument } from "../../core/src/index.ts";
import { AGENT_CLIENT_SCRIPT } from "./client.ts";
import { selectLandingDocument } from "./landing.ts";
import { renderAgentPage, renderDocumentPage, renderGraphPage } from "./render.ts";

async function write(target: string, relative: string, contents: string): Promise<void> {
  const destination = path.join(target, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf8");
}

function publicDocument(document: KnowledgeDocument): Record<string, unknown> {
  return {
    aliases: document.aliases,
    embeds: document.embeds,
    id: document.id,
    imports: document.imports,
    mentions: document.mentions,
    path: document.path,
    project_id: document.projectId,
    references: document.references,
    source_hash: document.sourceHash,
    status: document.status,
    summary: document.summary,
    title: document.title,
    token_estimate: document.tokenEstimate,
    type: document.type,
    wikilinks: document.wikilinks,
  };
}

function llmsText(result: CompileResult): string {
  const project = result.project!;
  return [
    `# ${project.title}`,
    "",
    "> Project-scoped Markdown knowledge compiled by Knotdown.",
    "",
    `Build-ID: ${project.buildId}`,
    `Project-ID: ${project.id}`,
    "",
    "## Documents",
    "",
    ...project.documents.map((document) => `- [${document.title}](docs/${document.id}/index.md): ${document.summary || `${document.type} note`}`),
    "",
  ].join("\n");
}

function landing(title: string, firstHref: string): string {
  const escapedTitle = title.replace(/[&<>"']/gu, (value) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[value]!);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${firstHref}"><title>${escapedTitle}</title></head><body><p><a href="${firstHref}">Open ${escapedTitle}</a></p><p><a href="llms.txt">llms.txt</a></p></body></html>`;
}

export async function populateStaticSite(outputRoot: string, result: CompileResult): Promise<void> {
  if (!result.project || result.hasErrors) throw new Error("Static site requires a successful compiled project.");
  const project = result.project;
  const site = path.join(outputRoot, "site");
  await write(site, "assets/agent.js", AGENT_CLIENT_SCRIPT);
  const documentFromPage = (target: KnowledgeDocument): string => `../${encodeURIComponent(target.id)}/`;
  for (const document of project.documents) {
    const base = path.join("docs", document.id);
    await write(site, path.join(base, "index.html"), renderDocumentPage(project, document, result.diagnostics, {
      agentHref: "../../agent/",
      documentHref: documentFromPage,
      graphHref: "../../graph/",
      homeHref: "../../",
      jsonHref: "index.json",
      markdownHref: "index.md",
    }));
    await write(site, path.join(base, "index.md"), document.raw);
    await write(site, path.join(base, "index.json"), stableJson({ build_id: project.buildId, document: publicDocument(document) }));
  }
  await write(site, "graph/index.html", renderGraphPage(project, result.diagnostics, {
    agentHref: "../agent/",
    documentHref: (document) => `../docs/${encodeURIComponent(document.id)}/`,
    graphHref: "./",
    homeHref: "../",
  }));
  const entrypoint = selectLandingDocument(project);
  if (entrypoint) {
    const runtime = createKnowledgeRuntime(project);
    const request = { projectId: project.id, entrypoint: entrypoint.path, query: "Project overview" };
    const context = runtime.buildContext(request);
    const explanation = runtime.explainContext(request);
    await write(site, "agent/index.html", renderAgentPage(project, context, explanation, {
      agentHref: "./",
      documentHref: (document) => `../docs/${encodeURIComponent(document.id)}/`,
      graphHref: "../graph/",
      homeHref: "../",
      entrypoint: entrypoint.path,
      query: request.query,
      scriptHref: "../assets/agent.js",
    }));
  }
  const landingDocument = selectLandingDocument(project);
  const firstHref = landingDocument ? `docs/${encodeURIComponent(landingDocument.id)}/` : "graph/";
  await write(site, "index.html", landing(project.title, firstHref));
  await write(site, "llms.txt", llmsText(result));
}
