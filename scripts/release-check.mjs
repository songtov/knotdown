import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const environment = { ...process.env, npm_config_cache: process.env.npm_config_cache ?? path.join(os.tmpdir(), "knotdown-npm-cache") };
const packageMetadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? root, encoding: "utf8", env: environment, stdio: options.capture ? "pipe" : "inherit", input: options.input });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed${result.stderr ? `:\n${result.stderr}` : ""}`);
  return result.stdout ?? "";
}

await (async () => {
  run(npm, ["run", "verify"]);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "knotdown-release-"));
  const packOutput = run(npm, ["pack", "--json", "--silent", "--pack-destination", temporary], { capture: true });
  const packed = JSON.parse(packOutput)[0];
  assert.ok(packed?.filename, "npm pack did not return a tarball filename.");
  const paths = packed.files.map((file) => file.path);
  assert.ok(paths.includes("dist/packages/cli/src/main.js"), "Tarball is missing the compiled CLI.");
  assert.ok(paths.includes("dist/packages/core/src/index.d.ts"), "Tarball is missing public type declarations.");
  assert.equal(paths.some((file) => file.endsWith(".ts") && !file.endsWith(".d.ts")), false, "Tarball contains TypeScript source.");
  assert.equal(paths.some((file) => file.startsWith("tests/") || file === "AGENTS.md" || file.startsWith(".maintainer-local/")), false, "Tarball contains repository-only files.");
  const unpackRoot = path.join(temporary, "unpacked");
  await mkdir(unpackRoot, { recursive: true });
  run("tar", ["-xzf", path.join(temporary, packed.filename), "-C", unpackRoot], { capture: true });
  for (const sourceMapPath of paths.filter((file) => file.endsWith(".map"))) {
    const sourceMap = await readFile(path.join(unpackRoot, "package", sourceMapPath), "utf8");
    assert.equal(sourceMap.includes(root), false, `Source map reveals the repository path: ${sourceMapPath}`);
  }

  const installRoot = path.join(temporary, "consumer");
  await mkdir(installRoot, { recursive: true });
  await writeFile(path.join(installRoot, "package.json"), '{"name":"knotdown-smoke","private":true,"type":"module"}\n', "utf8");
  const tarball = path.join(temporary, packed.filename);
  run(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { capture: false, cwd: installRoot });
  const cli = path.join(installRoot, "node_modules", "knotdown", "dist", "packages", "cli", "src", "main.js");
  assert.equal((await readFile(cli, "utf8")).startsWith("#!/usr/bin/env node"), true);
  await writeFile(path.join(installRoot, "imports.mjs"), `
import { compileProject } from "knotdown";
import { KnotdownMcpServer } from "knotdown/mcp";
import { startDevServer } from "knotdown/server";
import { renderGraphPage } from "knotdown/web";
for (const exported of [compileProject, KnotdownMcpServer, startDevServer, renderGraphPage]) {
  if (typeof exported !== "function") throw new Error("A public package export is missing.");
}
`, "utf8");
  run(process.execPath, [path.join(installRoot, "imports.mjs")], { capture: true, cwd: installRoot });
  const fixture = path.join(temporary, "project");
  await cp(path.join(root, "examples", "knotdown-project"), fixture, { recursive: true });
  assert.equal(run(process.execPath, [cli, "--version"], { capture: true }).trim(), packageMetadata.version);
  const help = run(process.execPath, [cli, "--help"], { capture: true });
  assert.match(help, /knotdown init/u);
  assert.match(help, /standard\|obsidian/u);
  const standardRoot = path.join(temporary, "existing-standard-markdown");
  await mkdir(standardRoot, { recursive: true });
  const standardNote = `---
id: "019ffc11-0000-7000-8000-000000000020"
type: "concept"
---

# Existing Markdown

The installed CLI must not rewrite this note.
`;
  const standardNotePath = path.join(standardRoot, "existing.md");
  await writeFile(standardNotePath, standardNote, "utf8");
  run(process.execPath, [cli, "init", standardRoot, "--preset", "standard"], { capture: true });
  run(process.execPath, [cli, "check", standardRoot], { capture: true });
  assert.equal(await readFile(standardNotePath, "utf8"), standardNote);
  run(process.execPath, [cli, "check", fixture], { capture: true });
  run(process.execPath, [cli, "build", fixture], { capture: true });
  run(process.execPath, [cli, "context", fixture, "--entry", "knowledge/reference/markdown-contract.md", "--query", "background context", "--budget", "4000"], { capture: true });
  const mcpInput = `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`;
  const mcpOutput = run(process.execPath, [cli, "mcp", fixture], { capture: true, input: mcpInput });
  assert.equal(JSON.parse(mcpOutput.trim()).result.tools.length, 5);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, "dev", fixture, "--port", "0"], { cwd: installRoot, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error(`Installed dev server did not start.\n${output}`)), 10_000);
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.stdout.on("data", async (chunk) => {
      output += chunk.toString();
      const match = /Knowledge Browser: (http:\/\/127\.0\.0\.1:\d+)/u.exec(output);
      if (!match || settled) return;
      try {
        const response = await fetch(match[1]);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /Knotdown/u);
        finish();
      } catch (error) {
        finish(error);
      }
    });
    child.on("error", finish);
    child.on("exit", (code) => {
      if (!settled && code !== null) finish(new Error(`Installed dev server exited with code ${code}.\n${output}`));
    });
  });
  console.log(`✓ Release tarball ${packed.filename} passed clean install and CLI smoke tests.`);
})();
