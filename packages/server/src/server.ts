import { watch as watchFiles } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { compileProject, createKnowledgeRuntime, KnowledgeRuntimeError, stableJson } from "../../core/src/index.ts";
import type { CompileResult, ContextRequest, EdgeType, KnowledgeDocument, TraverseDirection } from "../../core/src/index.ts";
import { AGENT_CLIENT_SCRIPT, renderAgentPage, renderDiagnosticsPage, renderDocumentPage, renderGraphPage, selectLandingDocument } from "../../web/src/index.ts";

export interface DevServerOptions {
  host?: "127.0.0.1";
  port?: number;
  watch?: boolean;
  onRebuild?: (result: CompileResult) => void;
}

export interface DevServer {
  url: string;
  host: "127.0.0.1";
  port: number;
  getResult(): CompileResult;
  refresh(): Promise<CompileResult>;
  close(): Promise<void>;
}

const securityHeaders = {
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function send(response: ServerResponse, status: number, contentType: string, body: string, headOnly = false): void {
  response.writeHead(status, { ...securityHeaders, "Content-Type": contentType, "Content-Length": Buffer.byteLength(body) });
  response.end(headOnly ? undefined : body);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { ...securityHeaders, Location: location });
  response.end();
}

function wireKey(value: string): string {
  return value.replace(/[A-Z]/gu, (character) => `_${character.toLocaleLowerCase("und")}`);
}

function wireValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(wireValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [wireKey(key), wireValue(item)]));
  }
  return value;
}

function sendApi(response: ServerResponse, status: number, value: unknown, diagnostics: CompileResult["diagnostics"], headOnly = false): void {
  send(response, status, "application/json; charset=utf-8", stableJson({
    protocol_version: "0.1",
    ok: status >= 200 && status < 300,
    ...(status >= 200 && status < 300 ? { data: wireValue(value) } : { error: wireValue(value) }),
    diagnostics,
  }), headOnly);
}

function runtimeStatus(error: unknown): number {
  if (!(error instanceof KnowledgeRuntimeError)) return 500;
  if (error.code === "KR002") return 403;
  if (error.code === "KR003") return 404;
  return 400;
}

function runtimeError(error: unknown): Record<string, string> {
  return error instanceof KnowledgeRuntimeError
    ? { code: error.code, message: error.message }
    : { code: "KR500", message: error instanceof Error ? error.message : String(error) };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576) throw new KnowledgeRuntimeError("KR001", "JSON request body exceeds 1 MiB.");
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new KnowledgeRuntimeError("KR001", "Request body must be valid JSON.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new KnowledgeRuntimeError("KR001", "Request body must be a JSON object.");
  return value as Record<string, unknown>;
}

function queryInteger(value: string | null, name: string): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new KnowledgeRuntimeError("KR001", `${name} must be an integer.`);
  return parsed;
}

function queryRelations(value: string | null): EdgeType[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean) as EdgeType[];
}

function contextRequest(projectId: string, body: Record<string, unknown>): ContextRequest {
  const allowed = ["query", "entrypoint", "depth", "token_budget", "max_documents", "relations"];
  const unknown = Object.keys(body).find((key) => !allowed.includes(key));
  if (unknown) throw new KnowledgeRuntimeError("KR001", `Unknown context request field '${unknown}'.`);
  if (typeof body.query !== "string") throw new KnowledgeRuntimeError("KR001", "query must be a string.");
  if (body.entrypoint !== undefined && typeof body.entrypoint !== "string") throw new KnowledgeRuntimeError("KR001", "entrypoint must be a string.");
  for (const key of ["depth", "token_budget", "max_documents"] as const) {
    if (body[key] !== undefined && typeof body[key] !== "number") throw new KnowledgeRuntimeError("KR001", `${key} must be a number.`);
  }
  if (body.relations !== undefined && (!Array.isArray(body.relations) || !body.relations.every((item) => typeof item === "string"))) {
    throw new KnowledgeRuntimeError("KR001", "relations must be a string array.");
  }
  return {
    projectId,
    query: body.query,
    ...(typeof body.entrypoint === "string" ? { entrypoint: body.entrypoint } : {}),
    ...(typeof body.depth === "number" ? { depth: body.depth } : {}),
    ...(typeof body.token_budget === "number" ? { tokenBudget: body.token_budget } : {}),
    ...(typeof body.max_documents === "number" ? { maxDocuments: body.max_documents } : {}),
    ...(Array.isArray(body.relations) ? { relations: body.relations as EdgeType[] } : {}),
  };
}

function publicDocument(document: KnowledgeDocument): Record<string, unknown> {
  return {
    aliases: document.aliases,
    ast: document.ast,
    embeds: document.embeds,
    id: document.id,
    imports: document.imports,
    mentions: document.mentions,
    path: document.path,
    project_id: document.projectId,
    references: document.references,
    wikilinks: document.wikilinks,
    source_hash: document.sourceHash,
    status: document.status,
    summary: document.summary,
    title: document.title,
    token_estimate: document.tokenEstimate,
    type: document.type,
  };
}

function decoded(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export async function startDevServer(inputRoot = process.cwd(), options: DevServerOptions = {}): Promise<DevServer> {
  const root = path.resolve(inputRoot);
  const host = options.host ?? "127.0.0.1";
  let current = await compileProject(root);
  let compiling: Promise<CompileResult> | undefined;
  const refresh = async (): Promise<CompileResult> => {
    if (compiling) return compiling;
    compiling = compileProject(root).then((result) => {
      current = result;
      options.onRebuild?.(result);
      return result;
    }).finally(() => {
      compiling = undefined;
    });
    return compiling;
  };

  const server = createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      if (method !== "GET" && method !== "HEAD" && method !== "POST") {
        response.setHeader("Allow", "GET, HEAD, POST");
        send(response, 405, "text/plain; charset=utf-8", "Method not allowed\n", method === "HEAD");
        return;
      }
      const headOnly = method === "HEAD";
      const requestUrl = new URL(request.url ?? "/", `http://${host}`);
      if (requestUrl.pathname === "/__knotdown/health") {
        send(response, 200, "application/json; charset=utf-8", stableJson({ build_id: current.project?.buildId, has_errors: current.hasErrors, project_id: current.project?.id }), headOnly);
        return;
      }
      const project = current.project;
      if (!project) {
        send(response, 503, "text/html; charset=utf-8", renderDiagnosticsPage("Project cannot be compiled", current.diagnostics), headOnly);
        return;
      }
      const runtime = createKnowledgeRuntime(project);
      const home = `/p/${encodeURIComponent(project.slug)}`;
      const firstDocument = selectLandingDocument(project);
      const sourceHref = project.config.content.dialect === "obsidian"
        ? (document: KnowledgeDocument): string => `obsidian://open?path=${encodeURIComponent(document.absolutePath)}`
        : undefined;
      if (requestUrl.pathname === `${home}/assets/agent.js`) {
        if (method === "POST") {
          response.setHeader("Allow", "GET, HEAD");
          send(response, 405, "text/plain; charset=utf-8", "Method not allowed\n");
          return;
        }
        send(response, 200, "text/javascript; charset=utf-8", AGENT_CLIENT_SCRIPT, headOnly);
        return;
      }
      if (requestUrl.pathname === "/" || requestUrl.pathname === home) {
        if (!firstDocument) {
          send(response, 200, "text/html; charset=utf-8", renderDiagnosticsPage(project.title, current.diagnostics), headOnly);
          return;
        }
        redirect(response, `${home}/docs/${encodeURIComponent(firstDocument.id)}`);
        return;
      }

      if (requestUrl.pathname === `${home}/agent`) {
        if (method === "POST") {
          response.setHeader("Allow", "GET, HEAD");
          send(response, 405, "text/plain; charset=utf-8", "Method not allowed\n");
          return;
        }
        const query = requestUrl.searchParams.get("q") ?? "";
        const entrypoint = requestUrl.searchParams.get("entry") ?? firstDocument?.path ?? "";
        const tokenBudget = queryInteger(requestUrl.searchParams.get("budget"), "budget") ?? project.config.retrieval.default_token_budget;
        const depth = queryInteger(requestUrl.searchParams.get("depth"), "depth") ?? project.config.retrieval.default_depth;
        try {
          const context = query ? runtime.buildContext({ projectId: project.id, query, entrypoint, tokenBudget, depth }) : undefined;
          const explanation = query ? runtime.explainContext({ projectId: project.id, query, entrypoint, tokenBudget, depth }) : undefined;
          send(response, current.hasErrors ? 409 : 200, "text/html; charset=utf-8", renderAgentPage(project, context, explanation, {
            homeHref: home,
            graphHref: `${home}/graph`,
            agentHref: `${home}/agent`,
            documentHref: (target) => `${home}/docs/${encodeURIComponent(target.id)}`,
            query,
            entrypoint,
            tokenBudget,
            depth,
            scriptHref: `${home}/assets/agent.js`,
            sourceHref,
          }), headOnly);
        } catch (error) {
          send(response, runtimeStatus(error), "text/html; charset=utf-8", renderAgentPage(project, undefined, undefined, {
            homeHref: home,
            graphHref: `${home}/graph`,
            agentHref: `${home}/agent`,
            query,
            entrypoint,
            tokenBudget,
            depth,
            error: runtimeError(error).message,
            scriptHref: `${home}/assets/agent.js`,
            sourceHref,
          }), headOnly);
        }
        return;
      }

      if (requestUrl.pathname === `${home}/graph`) {
        if (method === "POST") {
          response.setHeader("Allow", "GET, HEAD");
          send(response, 405, "text/plain; charset=utf-8", "Method not allowed\n");
          return;
        }
        const requestedRelation = requestUrl.searchParams.get("relation");
        const relation = (["all", "imports", "embeds", "references", "mentions"] as const).find((value) => value === requestedRelation) ?? "all";
        const route = (target: KnowledgeDocument): string => `${home}/docs/${encodeURIComponent(target.id)}`;
        send(response, current.hasErrors ? 409 : 200, "text/html; charset=utf-8", renderGraphPage(project, current.diagnostics, {
          documentHref: route,
          graphHref: `${home}/graph`,
          agentHref: `${home}/agent`,
          homeHref: home,
          relation,
          sourceHref,
        }), headOnly);
        return;
      }

      const projectApiMatch = /^\/api\/v1\/projects\/([^/]+)(?:\/(.*))?$/u.exec(requestUrl.pathname);
      if (projectApiMatch) {
        const slug = decoded(projectApiMatch[1]!);
        const operation = projectApiMatch[2] ?? "";
        if (slug !== project.slug) {
          sendApi(response, 404, { code: "KR003", message: "Project not found." }, current.diagnostics, headOnly);
          return;
        }
        if (current.hasErrors) {
          sendApi(response, 409, { code: "KR409", message: "The current project build has blocking diagnostics." }, current.diagnostics, headOnly);
          return;
        }
        try {
          if (!operation && (method === "GET" || method === "HEAD")) {
            sendApi(response, 200, runtime.describeProject(), current.diagnostics, headOnly);
            return;
          }
          if (operation === "search" && (method === "GET" || method === "HEAD")) {
            const query = requestUrl.searchParams.get("q") ?? "";
            const limit = queryInteger(requestUrl.searchParams.get("limit"), "limit");
            sendApi(response, 200, runtime.searchKnowledge({ projectId: project.id, query, ...(limit === undefined ? {} : { limit }) }), current.diagnostics, headOnly);
            return;
          }
          if (operation === "traverse" && (method === "GET" || method === "HEAD")) {
            const start = requestUrl.searchParams.get("start") ?? "";
            const direction = (requestUrl.searchParams.get("direction") ?? undefined) as TraverseDirection | undefined;
            const relations = queryRelations(requestUrl.searchParams.get("relations"));
            const depth = queryInteger(requestUrl.searchParams.get("depth"), "depth");
            const maxDocuments = queryInteger(requestUrl.searchParams.get("max_documents"), "max_documents");
            sendApi(response, 200, runtime.traverseGraph({
              projectId: project.id,
              start,
              ...(direction === undefined ? {} : { direction }),
              ...(relations === undefined ? {} : { relations }),
              ...(depth === undefined ? {} : { depth }),
              ...(maxDocuments === undefined ? {} : { maxDocuments }),
            }), current.diagnostics, headOnly);
            return;
          }
          const apiDocumentMatch = /^documents\/([^/]+)$/u.exec(operation);
          if (apiDocumentMatch && (method === "GET" || method === "HEAD")) {
            const identifier = decoded(apiDocumentMatch[1]!);
            if (!identifier) throw new KnowledgeRuntimeError("KR001", "Invalid document identifier encoding.");
            const representation = requestUrl.searchParams.get("representation") ?? undefined;
            sendApi(response, 200, runtime.readDocument({ projectId: project.id, document: identifier, ...(representation === undefined ? {} : { representation: representation as "full" | "summary" | "metadata" }) }), current.diagnostics, headOnly);
            return;
          }
          if ((operation === "context" || operation === "context/explain") && method === "POST") {
            const body = await readJsonBody(request);
            const context = contextRequest(project.id, body);
            sendApi(response, 200, operation === "context" ? runtime.buildContext(context) : runtime.explainContext(context), current.diagnostics, headOnly);
            return;
          }
          response.setHeader("Allow", operation === "context" || operation === "context/explain" ? "POST" : "GET, HEAD");
          sendApi(response, 405, { code: "KR405", message: "Method not allowed." }, current.diagnostics, headOnly);
        } catch (error) {
          sendApi(response, runtimeStatus(error), runtimeError(error), current.diagnostics, headOnly);
        }
        return;
      }

      const documentMatch = /^\/p\/([^/]+)\/docs\/([^/.]+?)(?:\.(md|json))?$/u.exec(requestUrl.pathname);
      if (!documentMatch) {
        send(response, 404, "text/plain; charset=utf-8", "Not found\n", headOnly);
        return;
      }
      if (method === "POST") {
        response.setHeader("Allow", "GET, HEAD");
        send(response, 405, "text/plain; charset=utf-8", "Method not allowed\n");
        return;
      }
      const slug = decoded(documentMatch[1]!);
      const documentId = decoded(documentMatch[2]!);
      const document = slug === project.slug ? project.documents.find((item) => item.id === documentId) : undefined;
      if (!document) {
        send(response, 404, "text/plain; charset=utf-8", "Document not found\n", headOnly);
        return;
      }
      const forcedFormat = documentMatch[3];
      const accept = request.headers.accept ?? "text/html";
      if (forcedFormat === "json" || (!forcedFormat && accept.includes("application/json"))) {
        send(response, 200, "application/json; charset=utf-8", stableJson({ build_id: project.buildId, document: publicDocument(document) }), headOnly);
        return;
      }
      if (forcedFormat === "md" || (!forcedFormat && accept.includes("text/markdown"))) {
        send(response, 200, "text/markdown; charset=utf-8", document.raw, headOnly);
        return;
      }
      const route = (target: KnowledgeDocument): string => `${home}/docs/${encodeURIComponent(target.id)}`;
      send(response, current.hasErrors ? 409 : 200, "text/html; charset=utf-8", renderDocumentPage(project, document, current.diagnostics, {
        documentHref: route,
        graphHref: `${home}/graph`,
        agentHref: `${home}/agent`,
        homeHref: home,
        jsonHref: `${route(document)}.json`,
        markdownHref: `${route(document)}.md`,
        sourceHref: sourceHref?.(document),
      }), headOnly);
    } catch (error) {
      send(response, 500, "text/plain; charset=utf-8", `Internal server error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(options.port ?? current.project?.config.server.port ?? 4317, host, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const watcher = options.watch === false ? undefined : watchFiles(root, { recursive: true }, (_event, filename) => {
    const changed = filename?.toString().replace(/\\/gu, "/") ?? "";
    if (changed.includes("/.knowledge/dist/") || changed.startsWith(".knowledge/dist/")) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void refresh(), 80);
  });

  return {
    url: `http://${host}:${address.port}`,
    host,
    port: address.port,
    getResult: () => current,
    refresh,
    close: async () => {
      if (debounce) clearTimeout(debounce);
      watcher?.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
