import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compileProject, initProject } from "../packages/core/src/index.ts";

async function temporaryProject(t: { after(callback: () => Promise<void>): void }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "knotdown-project-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("standard preset adopts conforming Markdown without changing it", async (t) => {
  const root = await temporaryProject(t);
  const notePath = path.join(root, "existing.md");
  const source = `---\nid: "019ffb01-0000-7000-8000-000000000001"\ntype: "concept"\n---\n\n# Existing Markdown\n\nThis note remains canonical.\n`;
  await writeFile(notePath, source, "utf8");

  const initialized = await initProject(root, "standard");
  assert.equal(initialized.identityPath, undefined);
  await assert.rejects(() => access(path.join(root, ".knowledge", "identities.json")));
  assert.equal(await readFile(notePath, "utf8"), source);

  const result = await compileProject(root);
  assert.ok(result.project);
  assert.equal(result.hasErrors, false, JSON.stringify(result.diagnostics));
  assert.equal(result.project.config.content.dialect, "standard");
  assert.equal(result.project.config.identity.require_document_id, true);
  assert.equal(result.project.config.mentions.enabled, true);
});

test("standard preset reports missing contracts without rewriting legacy Markdown", async (t) => {
  const root = await temporaryProject(t);
  const notePath = path.join(root, "legacy.md");
  const source = "---\nsummary: A legacy note missing required standard contracts.\n---\n\nA paragraph without a heading.\n";
  await writeFile(notePath, source, "utf8");

  await initProject(root, "standard");
  const result = await compileProject(root);
  assert.equal(result.hasErrors, true);
  assert.equal(result.diagnostics.some((item) => item.code === "KB101"), true);
  assert.equal(result.diagnostics.some((item) => item.code === "KB401" && item.message.includes("Document type")), true);
  assert.equal(result.diagnostics.some((item) => item.code === "KB401" && item.message.includes("level-one heading")), true);
  assert.equal(await readFile(notePath, "utf8"), source);
});

test("init rejects unknown presets and existing project configuration", async (t) => {
  const root = await temporaryProject(t);
  await assert.rejects(() => initProject(root, "unknown" as "standard"), /Unknown preset/u);
  await initProject(root, "standard");
  await assert.rejects(() => initProject(root, "obsidian"), /Refusing to overwrite/u);
});
