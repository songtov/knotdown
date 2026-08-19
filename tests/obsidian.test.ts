import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { adoptProject, compileProject, emitArtifacts, initProject } from "../packages/core/src/index.ts";
import { startDevServer } from "../packages/server/src/index.ts";
import { populateStaticSite } from "../packages/web/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const exampleRoot = path.join(repositoryRoot, "examples", "obsidian-vault", "product-alpha");

async function noteSnapshot(root: string): Promise<Record<string, string>> {
  const files = ["Home.md", "notes/Local First.md", "notes/References.md"];
  return Object.fromEntries(await Promise.all(files.map(async (file) => [file, await readFile(path.join(root, file), "utf8")] as const)));
}

async function newObsidianProject(notes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-obsidian-"));
  for (const [relative, source] of Object.entries(notes)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source, "utf8");
  }
  await initProject(root, "obsidian");
  await adoptProject(root);
  return root;
}

test("Obsidian project resolves plain, aliased, heading, block, and embed wikilinks", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  assert.equal(result.hasErrors, false, JSON.stringify(result.diagnostics));
  assert.equal(result.project.documents.length, 3);
  assert.equal(result.project.documents.some((document) => document.path.includes("Private")), false);
  const home = result.project.documents.find((document) => document.path === "Home.md");
  assert.ok(home);
  assert.equal(home.wikilinks.length, 3);
  assert.equal(home.wikilinks.some((link) => link.display === "the local-first principle"), true);
  assert.equal(home.wikilinks.some((link) => link.fragment === "^source-block"), true);
  assert.equal(home.embeds.length, 1);
  assert.equal(home.embeds[0]?.fragment, "Sources");
  assert.equal(result.project.graph.edges.some((edge) => edge.type === "embeds" && edge.origin === "obsidian_embed"), true);
});

test("Obsidian source actions appear in Human, Graph, and Agent views", async (t) => {
  const devServer = await startDevServer(exampleRoot, { port: 0, watch: false });
  t.after(() => devServer.close());
  const project = devServer.getResult().project;
  assert.ok(project);
  const document = project.documents[0]!;
  const urls = [
    `${devServer.url}/p/${project.slug}/docs/${document.id}`,
    `${devServer.url}/p/${project.slug}/graph`,
    `${devServer.url}/p/${project.slug}/agent?entry=${encodeURIComponent(document.path)}&q=overview`,
  ];
  for (const url of urls) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Open in Obsidian/u);
  }
});

test("check and build inputs do not mutate copied Obsidian notes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-copy-"));
  await cp(exampleRoot, root, { recursive: true });
  const before = await noteSnapshot(root);
  const first = await compileProject(root);
  assert.ok(first.project);
  assert.equal(first.hasErrors, false);
  const output = await emitArtifacts(first, { populate: populateStaticSite });
  const home = first.project.documents.find((document) => document.path === "Home.md");
  assert.ok(home);
  const human = await readFile(path.join(output, "site", "docs", home.id, "index.html"), "utf8");
  const graph = await readFile(path.join(output, "site", "graph", "index.html"), "utf8");
  const agent = await readFile(path.join(output, "site", "agent", "index.html"), "utf8");
  const llms = await readFile(path.join(output, "site", "llms.txt"), "utf8");
  assert.match(human, /rel="alternate" type="text\/markdown" href="index\.md"/u);
  assert.match(graph, new RegExp(first.project.buildId.slice(0, 12), "u"));
  assert.match(agent, new RegExp(first.project.buildId.slice(0, 12), "u"));
  assert.match(llms, new RegExp(first.project.buildId, "u"));
  assert.doesNotMatch(`${human}\n${graph}\n${agent}\n${llms}`, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  const second = await compileProject(root);
  assert.ok(second.project);
  assert.equal(second.hasErrors, false);
  assert.deepEqual(await noteSnapshot(root), before);
  assert.equal(second.project.buildId, first.project.buildId);
});

test("init and adopt create project metadata and stable IDs without editing notes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-adopt-"));
  const note = "# Home\n\nSee [[Linked]].\n";
  await writeFile(path.join(root, "Home.md"), note, "utf8");
  await writeFile(path.join(root, "Linked.md"), "A note without frontmatter or a heading.\n", "utf8");
  await initProject(root, "obsidian");
  const beforeAdopt = await compileProject(root);
  assert.equal(beforeAdopt.diagnostics.filter((item) => item.code === "KB101").length, 2);
  const adopted = await adoptProject(root);
  assert.equal(adopted.added, 2);
  const afterAdopt = await compileProject(root);
  assert.ok(afterAdopt.project);
  assert.equal(afterAdopt.hasErrors, false, JSON.stringify(afterAdopt.diagnostics));
  assert.equal(await readFile(path.join(root, "Home.md"), "utf8"), note);
  const ids = afterAdopt.project.documents.map((document) => document.id);
  await adoptProject(root);
  const repeated = await compileProject(root);
  assert.ok(repeated.project);
  assert.deepEqual(repeated.project.documents.map((document) => document.id), ids);
});

test("Obsidian resolver fails closed on missing, ambiguous, and boundary-escaping targets", async () => {
  const missingRoot = await newObsidianProject({ "Home.md": "# Home\n\n[[Missing]]\n" });
  const missing = await compileProject(missingRoot);
  assert.equal(missing.diagnostics.some((item) => item.code === "KB207"), true);

  const ambiguousRoot = await newObsidianProject({
    "Home.md": "# Home\n\n[[Target]]\n",
    "a/Target.md": "# Target A\n",
    "b/Target.md": "# Target B\n",
  });
  const ambiguous = await compileProject(ambiguousRoot);
  assert.equal(ambiguous.diagnostics.some((item) => item.code === "KB208"), true);

  const boundaryRoot = await newObsidianProject({ "Home.md": "# Home\n\n[[../Private]]\n" });
  const boundary = await compileProject(boundaryRoot);
  assert.equal(boundary.diagnostics.some((item) => item.code === "KB202"), true);
});
