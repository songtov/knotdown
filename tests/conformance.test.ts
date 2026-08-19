import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildContext, compileProject, emitArtifacts, stableJson } from "../packages/core/src/index.ts";

interface ValidCase {
  name: string;
  files: Record<string, string>;
  expected: {
    documents: number;
    imports: number;
    references: number;
    mentions: number;
    warnings?: string[];
  };
}

interface InvalidCase {
  name: string;
  files?: Record<string, string>;
  setup?: string;
  expected_codes: string[];
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const validManifest = JSON.parse(await readFile(path.join(repositoryRoot, "fixtures/valid/manifest.json"), "utf8")) as { cases: ValidCase[] };
const invalidManifest = JSON.parse(await readFile(path.join(repositoryRoot, "fixtures/invalid/manifest.json"), "utf8")) as { cases: InvalidCase[] };

function projectYaml(id = "019ff960-0000-7000-8000-000000000001", slug = "fixture-project", title = "Fixture Project"): string {
  return `spec: "0.1"
project:
  id: "${id}"
  slug: "${slug}"
  title: "${title}"
content:
  roots:
    - "knowledge"
  include:
    - "**/*.md"
  exclude: []
imports:
  allow_outside_project: false
  allow_symlink_escape: false
  warn_unused: true
mentions:
  enabled: true
  mode: "imported-labels"
  strength: "weak"
  mutate_source: false
retrieval:
  default_depth: 1
  max_depth: 3
  default_token_budget: 4000
  max_documents: 12
  semantic_search: "disabled"
build:
  output: ".knowledge/dist"
  emit: ["markdown", "json", "graph"]
server:
  host: "127.0.0.1"
  port: 4317
`;
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

async function createProject(t: { after(callback: () => Promise<void>): void }, files: Record<string, string>, options: { id?: string; slug?: string; title?: string } = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-conformance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFiles(root, {
    ".knowledge/project.yaml": projectYaml(options.id, options.slug, options.title),
    ...files,
  });
  return root;
}

test("fixture inventory contains at least twenty parser/resolver cases", () => {
  assert.ok(validManifest.cases.length + invalidManifest.cases.length >= 20);
  assert.equal(new Set([...validManifest.cases, ...invalidManifest.cases].map((fixture) => fixture.name)).size, validManifest.cases.length + invalidManifest.cases.length);
});

for (const fixture of validManifest.cases) {
  test(`valid fixture: ${fixture.name}`, async (t) => {
    const root = await createProject(t, fixture.files);
    const result = await compileProject(root);
    assert.equal(result.hasErrors, false, stableJson(result.diagnostics));
    assert.ok(result.project);
    assert.equal(result.project.documents.length, fixture.expected.documents);
    for (const [type, expected] of Object.entries({ imports: fixture.expected.imports, references: fixture.expected.references, mentions: fixture.expected.mentions })) {
      assert.equal(result.project.graph.edges.filter((edge) => edge.type === type).length, expected, `${fixture.name}: ${type}`);
    }
    const warningCodes = result.diagnostics.filter((item) => item.severity === "warning").map((item) => item.code);
    for (const code of fixture.expected.warnings ?? []) assert.ok(warningCodes.includes(code), `${fixture.name}: missing ${code}`);
  });
}

for (const fixture of invalidManifest.cases) {
  test(`invalid fixture: ${fixture.name}`, async (t) => {
    if (fixture.setup === "symlink-outside-project") {
      const parent = await mkdtemp(path.join(os.tmpdir(), "knotdown-symlink-"));
      t.after(() => rm(parent, { recursive: true, force: true }));
      const root = path.join(parent, "project");
      const outside = path.join(parent, "outside.md");
      await writeFiles(root, {
        ".knowledge/project.yaml": projectYaml(),
        "knowledge/source.md": "---\nid: \"019ff961-0000-7000-8000-000000000001\"\ntype: \"concept\"\n---\n\n[target]: ./target.md\n\n# Source\n\nSee [target].\n",
      });
      await writeFile(outside, "---\nid: \"019ff961-0000-7000-8000-000000000002\"\ntype: \"concept\"\n---\n\n# Outside\n\nOutside.\n", "utf8");
      await symlink(outside, path.join(root, "knowledge/target.md"));
      const result = await compileProject(root);
      assert.equal(result.hasErrors, true);
      const codes = result.diagnostics.map((item) => item.code);
      for (const code of fixture.expected_codes) assert.ok(codes.includes(code), `${fixture.name}: missing ${code}`);
      return;
    }
    const root = await createProject(t, fixture.files ?? {});
    const result = await compileProject(root);
    assert.equal(result.hasErrors, true);
    const codes = result.diagnostics.map((item) => item.code);
    for (const code of fixture.expected_codes) assert.ok(codes.includes(code), `${fixture.name}: missing ${code}\n${stableJson(result.diagnostics)}`);
  });
}

test("self-describing Knotdown example has the required graph and hover summaries", async () => {
  const root = path.join(repositoryRoot, "examples/knotdown-project");
  const result = await compileProject(root);
  assert.equal(result.hasErrors, false);
  assert.ok(result.project);
  assert.equal(result.project.documents.length, 8);
  assert.equal(result.project.graph.edges.filter((edge) => edge.type === "imports").length, 18);
  assert.equal(result.project.graph.edges.filter((edge) => edge.type === "references").length, 18);
  assert.equal(result.project.graph.edges.filter((edge) => edge.type === "mentions").length, 1);
  const boundary = result.project.documents.find((document) => document.title === "Project Boundary");
  assert.equal(boundary?.summary, "검색과 그래프, Context Pack이 하나의 명시적인 프로젝트 루트를 벗어나지 못하게 하는 안전 계약이다.");
  const diagnostics = result.project.documents.find((document) => document.title === "Context Diagnostics");
  assert.equal(diagnostics?.summary, "문서가 누락되거나 Context Pack이 예상과 다를 때 범위부터 선택 이유까지 점검하는 절차다.");
  const overview = result.project.documents.find((document) => document.title === "Knotdown");
  assert.equal(overview?.mentions.length, 1);
});

test("graph and build ID are deterministic and match the golden graph", async () => {
  const root = path.join(repositoryRoot, "examples/knotdown-project");
  const first = await compileProject(root);
  const second = await compileProject(root);
  assert.ok(first.project && second.project);
  assert.equal(first.project.buildId, second.project.buildId);
  assert.equal(stableJson(first.project.graph), stableJson(second.project.graph));
  const titles = new Map(first.project.graph.nodes.filter((node) => node.kind === "document").map((node) => [node.id, node.title]));
  const signature = {
    edge_counts: {
      imports: first.project.graph.edges.filter((edge) => edge.type === "imports").length,
      mentions: first.project.graph.edges.filter((edge) => edge.type === "mentions").length,
      references: first.project.graph.edges.filter((edge) => edge.type === "references").length,
    },
    imports: first.project.graph.edges.filter((edge) => edge.type === "imports").map((edge) =>
      `${titles.get(edge.from)} -> ${titles.get(edge.to)} [${edge.label}]`),
    mentions: first.project.graph.edges.filter((edge) => edge.type === "mentions").map((edge) =>
      `${titles.get(edge.from)} -> ${titles.get(edge.to)} [${edge.label}]`),
    nodes: first.project.graph.nodes.filter((node) => node.kind === "document").map((node) => ({
      path: node.path,
      title: node.title,
      type: node.document_type,
      status: node.status,
    })),
  };
  const golden = await readFile(path.join(repositoryRoot, "fixtures/golden/knotdown-project.graph.json"), "utf8");
  assert.equal(stableJson(signature), golden.replace(/\r\n?/gu, "\n"));
});

test("context is scoped, explainable, cycle-safe, and within budget", async (t) => {
  const result = await compileProject(path.join(repositoryRoot, "examples/knotdown-project"));
  assert.ok(result.project);
  const context = buildContext(result.project, {
    projectId: result.project.id,
    entrypoint: "knowledge/reference/markdown-contract.md",
    query: "기존 Markdown을 Agent 배경으로 제공하는 방법",
    depth: 2,
    tokenBudget: 250,
  });
  assert.ok(context.estimatedTokens <= 250);
  assert.equal(context.items[0]?.reason, "entrypoint");
  assert.equal(context.items[1]?.reason, "Markdown Contract imports Project Boundary");
  assert.equal(context.items[1]?.representation, "summary");
  assert.throws(() => buildContext(result.project!, { projectId: "019ff999-0000-7000-8000-000000000099", query: "auth" }), /scope mismatch/u);
  assert.throws(() => buildContext(result.project!, { projectId: "", query: "auth" }), /required/u);

  const cycleFixture = validManifest.cases.find((item) => item.name === "circular-import")!;
  const cycleRoot = await createProject(t, cycleFixture.files);
  const cycleResult = await compileProject(cycleRoot);
  assert.ok(cycleResult.project);
  const cycleContext = buildContext(cycleResult.project, {
    projectId: cycleResult.project.id,
    entrypoint: "knowledge/a.md",
    query: "cycle",
    depth: 3,
    tokenBudget: 2000,
  });
  assert.equal(cycleContext.items.length, 2);
  assert.equal(new Set(cycleContext.items.map((item) => item.documentId)).size, 2);
});

test("two projects with the same local term remain isolated", async (t) => {
  const sharedA = "019ff970-0000-7000-8000-000000000001";
  const sharedB = "019ff970-0000-7000-8000-000000000002";
  const source = (sourceId: string, targetId: string, title: string, meaning: string): Record<string, string> => ({
    "knowledge/index.md": `---\nid: "${sourceId}"\ntype: "procedure"\n---\n\n[세션]: ./session.md\n\n# ${title}\n\n[세션]을 확인한다.\n`,
    "knowledge/session.md": `---\nid: "${targetId}"\ntype: "concept"\n---\n\n# Session\n\n${meaning}\n`,
  });
  const rootA = await createProject(t, source("019ff970-0001-7000-8000-000000000003", sharedA, "Web Login", "An authentication session."), { id: "019ff970-0001-7000-8000-000000000004", slug: "project-a", title: "Project A" });
  const rootB = await createProject(t, source("019ff970-0002-7000-8000-000000000005", sharedB, "Conference", "A conference presentation block."), { id: "019ff970-0002-7000-8000-000000000006", slug: "project-b", title: "Project B" });
  const [resultA, resultB] = await Promise.all([compileProject(rootA), compileProject(rootB)]);
  assert.ok(resultA.project && resultB.project);
  assert.ok(resultA.project.graph.nodes.every((node) => node.project_id === resultA.project!.id));
  assert.ok(resultB.project.graph.nodes.every((node) => node.project_id === resultB.project!.id));
  const contextA = buildContext(resultA.project, { projectId: resultA.project.id, entrypoint: "knowledge/index.md", query: "세션", tokenBudget: 1000 });
  assert.ok(contextA.content.includes("An authentication session."));
  assert.ok(!contextA.content.includes("conference presentation"));
  assert.ok(!contextA.content.includes(sharedB));
});

test("failed compilation leaves the last successful atomic output untouched", async (t) => {
  const fixture = validManifest.cases.find((item) => item.name === "valid-local-import")!;
  const root = await createProject(t, fixture.files);
  const successful = await compileProject(root);
  assert.equal(successful.hasErrors, false);
  const output = await emitArtifacts(successful);
  const before = await readFile(path.join(output, "manifest.json"), "utf8");
  const sourcePath = path.join(root, "knowledge/a.md");
  const broken = (await readFile(sourcePath, "utf8")).replace("./b.md", "./missing.md");
  await writeFile(sourcePath, broken, "utf8");
  const failed = await compileProject(root);
  assert.equal(failed.hasErrors, true);
  await assert.rejects(() => emitArtifacts(failed), /blocking diagnostics/u);
  const after = await readFile(path.join(output, "manifest.json"), "utf8");
  assert.equal(after, before);
});
