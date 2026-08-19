import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject, createKnowledgeRuntime } from "../packages/core/src/index.ts";
import { startDevServer } from "../packages/server/src/index.ts";
import { renderAgentPage, renderDocumentPage, renderGraphPage, selectLandingDocument } from "../packages/web/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const exampleRoot = path.join(repositoryRoot, "examples/knotdown-project");

test("example landing prefers a Home, Overview, or guide document", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  assert.equal(selectLandingDocument(result.project).title, "Knotdown");
});

test("Human View renders the compiler IR with navigation, inspector, and hover summary", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const contract = result.project.documents.find((document) => document.title === "Markdown Contract");
  assert.ok(contract);
  const html = renderDocumentPage(result.project, contract, result.diagnostics);
  assert.match(html, /Project modules/u);
  assert.match(html, /<h2>start here<\/h2>[\s\S]*Knotdown/u);
  assert.match(html, /Inspector/u);
  assert.match(html, /class="hover-card"/u);
  assert.match(html, /검색과 그래프, Context Pack이 하나의 명시적인 프로젝트 루트를 벗어나지 못하게 하는 안전 계약이다\./u);
  assert.match(html, /019ffc20-0000-7000-8000-000000000002/u);
  assert.match(html, /Representations/u);
  assert.match(html, />Graph<\/a>/u);
});

test("Graph View renders typed project edges and relation filters", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const html = renderGraphPage(result.project, result.diagnostics);
  assert.match(html, /Project relationships/u);
  assert.match(html, /class="graph-edge imports"/u);
  assert.match(html, /class="graph-edge references"/u);
  assert.match(html, /class="graph-edge mentions"/u);
  assert.match(html, /Background Context/u);
  assert.match(html, /Markdown Contract/u);
  const importsOnly = renderGraphPage(result.project, result.diagnostics, { relation: "imports" });
  assert.match(importsOnly, /class="graph-edge imports"/u);
  assert.doesNotMatch(importsOnly, /class="graph-edge references"/u);
});

test("Human, Graph, and Agent views carry one build ID and themes cannot inject CSS", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const document = result.project.documents[0]!;
  const runtime = createKnowledgeRuntime(result.project);
  const request = { projectId: result.project.id, query: "overview", entrypoint: document.id };
  const shortBuildId = result.project.buildId.slice(0, 12);
  const human = renderDocumentPage(result.project, document, result.diagnostics, { theme: { colors: { accent: "#7652b3" } } });
  const graph = renderGraphPage(result.project, result.diagnostics);
  const agent = renderAgentPage(result.project, runtime.buildContext(request), runtime.explainContext(request));
  for (const html of [human, graph, agent]) assert.match(html, new RegExp(shortBuildId, "u"));
  assert.match(human, /--accent:#7652b3/u);
  assert.throws(() => renderDocumentPage(result.project!, document, [], { theme: { colors: { accent: "red;body{display:none}" } } }), /hex color/u);
});

test("Agent View renders the exact runtime context and its inclusion decisions", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const runtime = createKnowledgeRuntime(result.project);
  const request = {
    projectId: result.project.id,
    entrypoint: "knowledge/reference/markdown-contract.md",
    query: "기존 Markdown을 Agent 배경으로 제공하는 방법",
    tokenBudget: 4000,
  };
  const context = runtime.buildContext(request);
  const explanation = runtime.explainContext(request);
  const html = renderAgentPage(result.project, context, explanation, { query: request.query, entrypoint: request.entrypoint, scriptHref: "/assets/agent.js" });
  assert.match(html, /Context debugger/u);
  assert.match(html, /Shared runtime result/u);
  assert.match(html, /Markdown Contract imports Project Boundary/u);
  assert.match(html, /UNTRUSTED KNOWLEDGE CONTENT/u);
  assert.match(html, />Agent<\/a>/u);
  assert.match(html, /id="copy-context"/u);
  assert.match(html, /src="\/assets\/agent\.js"/u);
  assert.doesNotMatch(html, /onclick=/u);
});

test("Human View escapes source HTML instead of executing it", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-browser-escape-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".knowledge"), { recursive: true });
  await mkdir(path.join(root, "knowledge"), { recursive: true });
  await writeFile(path.join(root, ".knowledge/project.yaml"), `spec: "0.1"
project:
  id: "019ff980-0000-7000-8000-000000000001"
  slug: "escape-test"
  title: "Escape Test"
content:
  roots: ["knowledge"]
`, "utf8");
  await writeFile(path.join(root, "knowledge/index.md"), `---
id: "019ff980-0000-7000-8000-000000000002"
type: "concept"
---

# Safe

<script>alert("unsafe")</script>
`, "utf8");
  const result = await compileProject(root);
  assert.ok(result.project);
  const html = renderDocumentPage(result.project, result.project.documents[0]!, result.diagnostics);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.match(html, /&lt;script&gt;alert/u);
});

test("dev server serves HTML, Markdown, and JSON from the same document", async (t) => {
  const devServer = await startDevServer(exampleRoot, { port: 0, watch: false });
  t.after(() => devServer.close());
  const project = devServer.getResult().project;
  assert.ok(project);
  const landing = selectLandingDocument(project);
  assert.ok(landing);
  const landingResponse = await fetch(devServer.url);
  assert.equal(landingResponse.status, 200);
  assert.match(landingResponse.url, new RegExp(`/docs/${landing.id}$`, "u"));
  assert.match(await landingResponse.text(), /Markdown을 사람이 탐색할 수 있는 문서 사이트와 AI Agent가 작업 전에 읽을 수 있는/u);
  const contract = project.documents.find((document) => document.title === "Markdown Contract");
  assert.ok(contract);
  const documentUrl = `${devServer.url}/p/${project.slug}/docs/${contract.id}`;

  const htmlResponse = await fetch(documentUrl);
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get("content-type") ?? "", /^text\/html/u);
  assert.match(htmlResponse.headers.get("content-security-policy") ?? "", /default-src 'none'/u);
  assert.match(htmlResponse.headers.get("content-security-policy") ?? "", /script-src 'self'/u);
  assert.match(await htmlResponse.text(), /<h1[^>]*>Markdown Contract<\/h1>/u);

  const graphResponse = await fetch(`${devServer.url}/p/${project.slug}/graph?relation=references`);
  assert.equal(graphResponse.status, 200);
  const graphHtml = await graphResponse.text();
  assert.match(graphHtml, /Project relationships/u);
  assert.match(graphHtml, /class="graph-edge references"/u);
  assert.doesNotMatch(graphHtml, /class="graph-edge imports"/u);

  const agentResponse = await fetch(`${devServer.url}/p/${project.slug}/agent?entry=${encodeURIComponent(contract.path)}&q=${encodeURIComponent("기존 Markdown을 Agent 배경으로 제공하는 방법")}&budget=4000&depth=1`);
  assert.equal(agentResponse.status, 200);
  const agentHtml = await agentResponse.text();
  assert.match(agentHtml, /Markdown Contract imports Project Boundary/u);
  assert.match(agentHtml, new RegExp(`${project.slug}/assets/agent\\.js`, "u"));
  const agentScriptResponse = await fetch(`${devServer.url}/p/${project.slug}/assets/agent.js`);
  assert.equal(agentScriptResponse.status, 200);
  assert.match(agentScriptResponse.headers.get("content-type") ?? "", /^text\/javascript/u);
  assert.match(await agentScriptResponse.text(), /navigator\.clipboard\.writeText/u);
  assert.doesNotMatch(agentHtml, /Open in Obsidian/u);

  const markdownResponse = await fetch(documentUrl, { headers: { Accept: "text/markdown" } });
  assert.equal(markdownResponse.status, 200);
  assert.match(markdownResponse.headers.get("content-type") ?? "", /^text\/markdown/u);
  assert.match(await markdownResponse.text(), /# Markdown Contract/u);

  const jsonResponse = await fetch(`${documentUrl}.json`);
  assert.equal(jsonResponse.status, 200);
  const json = await jsonResponse.json() as { build_id: string; document: { id: string } };
  assert.equal(json.build_id, project.buildId);
  assert.equal(json.document.id, contract.id);

  const projectResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}`);
  assert.equal(projectResponse.status, 200);
  const projectJson = await projectResponse.json() as { protocol_version: string; ok: boolean; data: { build_id: string; capabilities: string[] } };
  assert.equal(projectJson.protocol_version, "0.1");
  assert.equal(projectJson.ok, true);
  assert.equal(projectJson.data.build_id, project.buildId);
  assert.ok(projectJson.data.capabilities.includes("build_context"));

  const searchResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/search?q=Project%20Boundary`);
  assert.equal(searchResponse.status, 200);
  const searchJson = await searchResponse.json() as { data: { items: Array<{ title: string }> } };
  assert.equal(searchJson.data.items[0]?.title, "Project Boundary");

  const traversalResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/traverse?start=${encodeURIComponent(contract.id)}&relations=imports,references&depth=1`);
  assert.equal(traversalResponse.status, 200);
  const traversalJson = await traversalResponse.json() as { data: { nodes: Array<{ title: string }> } };
  assert.deepEqual(traversalJson.data.nodes.map((node) => node.title), ["Markdown Contract", "Project Boundary"]);

  const contextBody = JSON.stringify({ query: "기존 Markdown을 Agent 배경으로 제공하는 방법", entrypoint: contract.path, token_budget: 4000, depth: 1 });
  const contextResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: contextBody,
  });
  assert.equal(contextResponse.status, 200);
  const contextJson = await contextResponse.json() as { data: { build_id: string; items: Array<{ reason: string }> } };
  assert.equal(contextJson.data.build_id, project.buildId);
  assert.equal(contextJson.data.items[1]?.reason, "Markdown Contract imports Project Boundary");

  const explainResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/context/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: contextBody,
  });
  assert.equal(explainResponse.status, 200);
  const explainJson = await explainResponse.json() as { data: { build_id: string; decisions: Array<{ decision: string; reason: string }> } };
  assert.equal(explainJson.data.build_id, contextJson.data.build_id);
  assert.deepEqual(explainJson.data.decisions.filter((item) => item.decision === "included").map((item) => item.reason), contextJson.data.items.map((item) => item.reason));

  const invalidResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json",
  });
  assert.equal(invalidResponse.status, 400);
  const invalidJson = await invalidResponse.json() as { ok: boolean; error: { code: string } };
  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.error.code, "KR001");

  const unknownFieldResponse = await fetch(`${devServer.url}/api/v1/projects/${project.slug}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "Project Boundary", tokenBudget: 4000 }),
  });
  assert.equal(unknownFieldResponse.status, 400);
  const unknownFieldJson = await unknownFieldResponse.json() as { error: { message: string } };
  assert.match(unknownFieldJson.error.message, /Unknown context request field/u);

  assert.equal((await fetch(`${devServer.url}/p/another-project/docs/${contract.id}`)).status, 404);
  assert.equal((await fetch(`${devServer.url}/api/v1/projects/another-project/search?q=Project%20Boundary`)).status, 404);
  assert.equal((await fetch(documentUrl, { method: "POST" })).status, 405);
});
