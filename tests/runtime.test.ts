import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { compileProject, createKnowledgeRuntime, KnowledgeRuntimeError, stableJson } from "../packages/core/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const exampleRoot = path.join(repositoryRoot, "examples/knotdown-project");

test("Knowledge Runtime serves one deterministic read path for agents", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const runtime = createKnowledgeRuntime(result.project);

  const search = runtime.searchKnowledge({ projectId: result.project.id, query: "Project Boundary" });
  assert.equal(search.buildId, result.project.buildId);
  assert.equal(search.items[0]?.title, "Project Boundary");
  assert.ok(search.items[0]?.matches.includes("title"));

  const contract = result.project.documents.find((document) => document.title === "Markdown Contract");
  assert.ok(contract);
  const read = runtime.readDocument({ projectId: result.project.id, document: contract.path });
  assert.equal(read.documentId, contract.id);
  assert.match(read.content, /^UNTRUSTED KNOWLEDGE CONTENT/u);
  assert.match(read.content, /Source-Path: knowledge\/reference\/markdown-contract\.md/u);
  assert.doesNotMatch(read.content, new RegExp(result.project.root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

  const traversal = runtime.traverseGraph({
    projectId: result.project.id,
    start: contract.id,
    relations: ["imports", "references"],
    depth: 1,
  });
  assert.deepEqual(traversal.nodes.map((node) => node.title), ["Markdown Contract", "Project Boundary"]);
  assert.equal(traversal.nodes[1]?.reason, "Markdown Contract imports Project Boundary");
  assert.equal(new Set(traversal.nodes.map((node) => node.documentId)).size, traversal.nodes.length);

  const request = {
    projectId: result.project.id,
    entrypoint: contract.path,
    query: "기존 Markdown을 Agent 배경으로 제공하는 방법",
    depth: 2,
    tokenBudget: 220,
  };
  const context = runtime.buildContext(request);
  const explanation = runtime.explainContext(request);
  assert.equal(explanation.buildId, context.buildId);
  assert.deepEqual(
    explanation.decisions.filter((decision) => decision.decision === "included").map((decision) => ({
      documentId: decision.documentId,
      path: decision.path,
      reason: decision.reason,
      representation: decision.representation,
      tokens: decision.tokens,
    })),
    context.items.map((item) => ({
      documentId: item.documentId,
      path: item.path,
      reason: item.reason,
      representation: item.representation,
      tokens: item.tokens,
    })),
  );

  const second = createKnowledgeRuntime((await compileProject(exampleRoot)).project!);
  assert.equal(stableJson(second.searchKnowledge({ projectId: result.project.id, query: "Project Boundary" })), stableJson(search));
});

test("Knowledge Runtime fails closed on scope, identifiers, and traversal policy", async () => {
  const result = await compileProject(exampleRoot);
  assert.ok(result.project);
  const runtime = createKnowledgeRuntime(result.project);
  const otherProject = "019ff999-0000-7000-8000-000000000099";

  assert.throws(
    () => runtime.searchKnowledge({ projectId: otherProject, query: "Project Boundary" }),
    (error: unknown) => error instanceof KnowledgeRuntimeError && error.code === "KR002",
  );
  assert.throws(
    () => runtime.searchKnowledge({ projectId: result.project!.id, query: "" }),
    (error: unknown) => error instanceof KnowledgeRuntimeError && error.code === "KR001",
  );
  assert.throws(
    () => runtime.readDocument({ projectId: result.project!.id, document: "missing-document" }),
    (error: unknown) => error instanceof KnowledgeRuntimeError && error.code === "KR003",
  );
  assert.throws(
    () => runtime.traverseGraph({ projectId: result.project!.id, start: "Markdown Contract", relations: ["unknown" as "imports"] }),
    (error: unknown) => error instanceof KnowledgeRuntimeError && error.code === "KR001",
  );
  assert.throws(
    () => runtime.buildContext({ projectId: result.project!.id, query: "Project Boundary", relations: [] }),
    (error: unknown) => error instanceof KnowledgeRuntimeError && error.code === "KR001",
  );
});
