#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { adoptProject, buildContext, compileProject, emitArtifacts, initProject, stableJson } from "../../core/src/index.ts";
import type { Diagnostic } from "../../core/src/index.ts";
import { startDevServer } from "../../server/src/index.ts";
import { populateStaticSite } from "../../web/src/index.ts";
import { runStdioMcp } from "../../mcp/src/index.ts";

const VERSION = "0.1.0-alpha.1";

function usage(): string {
  return `Knotdown ${VERSION}

Usage:
  knotdown init [PROJECT_ROOT] --preset standard|obsidian
  knotdown adopt [PROJECT_ROOT]
  knotdown check [PROJECT_ROOT] [--format text|json]
  knotdown build [PROJECT_ROOT]
  knotdown dev [PROJECT_ROOT] [--port N]
  knotdown graph [PROJECT_ROOT]
  knotdown context [PROJECT_ROOT] --entry ID_OR_PATH --query TEXT [--depth N] [--budget N]
  knotdown mcp [PROJECT_ROOT]
`;
}

function positionalRoot(args: string[]): string {
  return path.resolve(args[0] && !args[0].startsWith("--") ? args[0] : process.cwd());
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const values: string[] = [];
  for (let cursor = index + 1; cursor < args.length; cursor += 1) {
    const value = args[cursor]!;
    if (value.startsWith("--")) break;
    values.push(value);
  }
  return values.join(" ") || undefined;
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
  if (diagnostics.length === 0) {
    console.log("✓ No diagnostics");
    return;
  }
  for (const item of diagnostics) {
    const marker = item.severity === "error" ? "error" : "warning";
    console.error(`${item.source.path}:${item.source.line}:${item.source.column} ${marker} ${item.code} ${item.message}`);
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (command === "--version" || command === "-v" || command === "version") {
    console.log(VERSION);
    return;
  }
  if (!["init", "adopt", "check", "build", "dev", "graph", "context", "mcp"].includes(command)) throw new Error(`Unknown command '${command}'.\n\n${usage()}`);
  const root = positionalRoot(args);
  if (command === "init") {
    const preset = option(args, "--preset");
    if (preset !== "standard" && preset !== "obsidian") throw new Error("init requires --preset standard or obsidian.");
    const initialized = await initProject(root, preset);
    console.log(`✓ Initialized ${preset === "obsidian" ? "Obsidian" : "standard Markdown"} project at ${initialized.root}`);
    console.log(preset === "obsidian"
      ? "  Markdown files were not changed. Run 'knotdown adopt' to create stable sidecar IDs."
      : "  Markdown files were not changed. Add required id/type frontmatter where missing, then run 'knotdown check'.");
    return;
  }
  if (command === "adopt") {
    const adopted = await adoptProject(root);
    console.log(`✓ Added ${adopted.added} stable sidecar ID${adopted.added === 1 ? "" : "s"} (${adopted.total} total).`);
    const verified = await compileProject(root);
    printDiagnostics(verified.diagnostics);
    if (verified.hasErrors) process.exitCode = 1;
    return;
  }
  if (command === "mcp") {
    await runStdioMcp(root);
    return;
  }
  if (command === "dev") {
    const configuredPort = option(args, "--port");
    const port = configuredPort === undefined ? undefined : Number(configuredPort);
    if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65_535)) throw new Error("dev --port must be an integer from 0 to 65535.");
    const devServer = await startDevServer(root, {
      ...(port === undefined ? {} : { port }),
      onRebuild: (result) => {
        const errors = result.diagnostics.filter((item) => item.severity === "error").length;
        console.log(errors === 0 ? `✓ Rebuilt ${result.project?.documents.length ?? 0} documents` : `Rebuilt with ${errors} error${errors === 1 ? "" : "s"}`);
      },
    });
    printDiagnostics(devServer.getResult().diagnostics);
    console.log(`✓ Knowledge Browser: ${devServer.url}`);
    console.log("  Watching for Markdown and project configuration changes. Press Ctrl+C to stop.");
    const shutdown = (): void => {
      void devServer.close().finally(() => process.exit());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return;
  }
  const result = await compileProject(root);
  if (command === "check") {
    if (option(args, "--format") === "json") process.stdout.write(stableJson({ diagnostics: result.diagnostics, has_errors: result.hasErrors, project_id: result.project?.id }));
    else {
      printDiagnostics(result.diagnostics);
      if (result.project) console.log(`Checked ${result.project.documents.length} documents in project ${result.project.slug}.`);
    }
    if (result.hasErrors) process.exitCode = 1;
    return;
  }
  if (!result.project || result.hasErrors) {
    printDiagnostics(result.diagnostics);
    process.exitCode = 1;
    return;
  }
  if (command === "build") {
    const emitStatic = result.project.config.build.emit.includes("site") || result.project.config.build.emit.includes("llms-txt");
    const output = await emitArtifacts(result, emitStatic ? { populate: populateStaticSite } : {});
    printDiagnostics(result.diagnostics);
    const imports = result.project.graph.edges.filter((edge) => edge.type === "imports").length;
    const references = result.project.graph.edges.filter((edge) => edge.type === "references").length;
    const mentions = result.project.graph.edges.filter((edge) => edge.type === "mentions").length;
    console.log(`✓ Parsed ${result.project.documents.length} documents`);
    console.log(`✓ Resolved ${imports} imports`);
    console.log(`✓ Indexed ${references} explicit references`);
    console.log(`✓ Detected ${mentions} implicit mentions`);
    console.log(`✓ Generated ${path.relative(process.cwd(), output) || output}`);
    return;
  }
  if (command === "graph") {
    process.stdout.write(stableJson({ build_id: result.project.buildId, ...result.project.graph }));
    return;
  }
  const entrypoint = option(args, "--entry");
  const query = option(args, "--query");
  if (!entrypoint || !query) throw new Error("context requires --entry and --query.");
  const depthValue = option(args, "--depth");
  const budgetValue = option(args, "--budget");
  const pack = buildContext(result.project, {
    projectId: result.project.id,
    entrypoint,
    query,
    ...(depthValue ? { depth: Number(depthValue) } : {}),
    ...(budgetValue ? { tokenBudget: Number(budgetValue) } : {}),
  });
  process.stdout.write(stableJson(pack));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
