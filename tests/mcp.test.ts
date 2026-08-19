import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { compileProject } from "../packages/core/src/index.ts";
import { KnotdownMcpServer } from "../packages/mcp/src/index.ts";

const exampleRoot = path.resolve(import.meta.dirname, "..", "examples", "knotdown-project");

test("read-only MCP tools expose the shared runtime and build ID", async () => {
  const compiled = await compileProject(exampleRoot);
  assert.ok(compiled.project);
  assert.equal(compiled.hasErrors, false);
  const server = new KnotdownMcpServer(compiled.project);
  const listed = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tools = (listed?.result as { tools: Array<{ name: string; annotations: Record<string, boolean> }> }).tools;
  assert.deepEqual(tools.map((tool) => tool.name), ["search_knowledge", "read_document", "traverse_graph", "build_context", "explain_context"]);
  assert.equal(tools.every((tool) => tool.annotations.readOnlyHint && tool.annotations.destructiveHint === false), true);

  const called = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "build_context", arguments: { project_id: compiled.project.id, query: "background context", entrypoint: "knowledge/reference/markdown-contract.md" } },
  });
  const result = called?.result as { isError: boolean; structuredContent: { buildId: string; content: string; items: unknown[]; excluded: unknown[] } };
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.buildId, compiled.project.buildId);
  assert.match(result.structuredContent.content, /UNTRUSTED KNOWLEDGE CONTENT/u);
  assert.ok(Array.isArray(result.structuredContent.items));
  assert.ok(Array.isArray(result.structuredContent.excluded));
});

test("MCP supports modern discovery, legacy initialization, and fails closed on project mismatch", async () => {
  const compiled = await compileProject(exampleRoot);
  assert.ok(compiled.project);
  const server = new KnotdownMcpServer(compiled.project);
  const discovered = await server.handle({ jsonrpc: "2.0", id: "d", method: "server/discover" });
  assert.deepEqual((discovered?.result as { supportedVersions: string[] }).supportedVersions, ["2026-07-28", "2025-11-25"]);
  const initialized = await server.handle({ jsonrpc: "2.0", id: "i", method: "initialize", params: { protocolVersion: "2025-11-25" } });
  assert.equal((initialized?.result as { capabilities: { tools: unknown } }).capabilities.tools !== undefined, true);
  const rejected = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "search_knowledge", arguments: { project_id: "outside-project", query: "background context" } },
  });
  const result = rejected?.result as { isError: boolean; content: Array<{ text: string }> };
  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /Project scope mismatch/u);
});
