import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { Diagnostic, ProjectConfig } from "./types.ts";
import { diagnostic, isUuidV7, relativePosix } from "./util.ts";
import { parseYaml, YamlParseError } from "./yaml.ts";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function checkKeys(value: Record<string, unknown>, allowed: string[], prefix: string, diagnostics: Diagnostic[], configPath: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) diagnostics.push(diagnostic("KB001", "error", `Unknown project configuration key '${prefix}${key}'.`, { path: configPath, line: 1, column: 1 }));
  }
}

export interface LoadedConfig {
  root: string;
  path: string;
  raw: string;
  config?: ProjectConfig;
  diagnostics: Diagnostic[];
}

export async function loadProjectConfig(inputRoot: string): Promise<LoadedConfig> {
  const diagnostics: Diagnostic[] = [];
  let root: string;
  try {
    root = await realpath(path.resolve(inputRoot));
  } catch {
    root = path.resolve(inputRoot);
    diagnostics.push(diagnostic("KB001", "error", "Project root does not exist.", { path: ".knowledge/project.yaml", line: 1, column: 1 }));
    return { root, path: path.join(root, ".knowledge/project.yaml"), raw: "", diagnostics };
  }
  const configAbsolutePath = path.join(root, ".knowledge", "project.yaml");
  const configPath = relativePosix(root, configAbsolutePath);
  let raw = "";
  try {
    raw = await readFile(configAbsolutePath, "utf8");
  } catch {
    diagnostics.push(diagnostic("KB001", "error", "Missing .knowledge/project.yaml.", { path: configPath, line: 1, column: 1 }));
    return { root, path: configAbsolutePath, raw, diagnostics };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    const line = error instanceof YamlParseError ? error.line : 1;
    diagnostics.push(diagnostic("KB001", "error", `Invalid project YAML: ${error instanceof Error ? error.message : String(error)}`, { path: configPath, line, column: 1 }));
    return { root, path: configAbsolutePath, raw, diagnostics };
  }

  checkKeys(parsed, ["spec", "project", "content", "identity", "imports", "mentions", "retrieval", "build", "server"], "", diagnostics, configPath);
  const project = record(parsed.project);
  const content = record(parsed.content);
  const identity = record(parsed.identity) ?? {};
  const imports = record(parsed.imports) ?? {};
  const mentions = record(parsed.mentions) ?? {};
  const retrieval = record(parsed.retrieval) ?? {};
  const build = record(parsed.build) ?? {};
  const server = record(parsed.server) ?? {};
  if (parsed.spec !== "0.1") diagnostics.push(diagnostic("KB001", "error", "Project spec must be '0.1'.", { path: configPath, line: 1, column: 1 }));
  if (!project) diagnostics.push(diagnostic("KB001", "error", "Project mapping is required.", { path: configPath, line: 1, column: 1 }));
  if (!content) diagnostics.push(diagnostic("KB001", "error", "Content mapping is required.", { path: configPath, line: 1, column: 1 }));
  if (!project || !content) return { root, path: configAbsolutePath, raw, diagnostics };

  checkKeys(project, ["id", "slug", "title", "language"], "project.", diagnostics, configPath);
  checkKeys(content, ["roots", "include", "exclude", "dialect"], "content.", diagnostics, configPath);
  checkKeys(identity, ["strategy", "require_document_id"], "identity.", diagnostics, configPath);
  checkKeys(imports, ["allow_outside_project", "allow_symlink_escape", "warn_unused"], "imports.", diagnostics, configPath);
  checkKeys(mentions, ["enabled", "mode", "strength", "mutate_source"], "mentions.", diagnostics, configPath);
  checkKeys(retrieval, ["default_depth", "max_depth", "default_token_budget", "max_documents", "semantic_search"], "retrieval.", diagnostics, configPath);
  checkKeys(build, ["output", "emit"], "build.", diagnostics, configPath);
  checkKeys(server, ["host", "port"], "server.", diagnostics, configPath);

  const roots = stringArray(content.roots);
  if (!isUuidV7(project.id)) diagnostics.push(diagnostic("KB001", "error", "project.id must be a UUIDv7 string.", { path: configPath, line: 1, column: 1 }));
  if (typeof project.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(project.slug)) diagnostics.push(diagnostic("KB001", "error", "project.slug must be a lowercase kebab-case string.", { path: configPath, line: 1, column: 1 }));
  if (typeof project.title !== "string" || !project.title.trim()) diagnostics.push(diagnostic("KB001", "error", "project.title is required.", { path: configPath, line: 1, column: 1 }));
  if (!roots || roots.length === 0) diagnostics.push(diagnostic("KB001", "error", "content.roots must be a non-empty string sequence.", { path: configPath, line: 1, column: 1 }));
  if (content.dialect !== undefined && content.dialect !== "standard" && content.dialect !== "obsidian") diagnostics.push(diagnostic("KB001", "error", "content.dialect must be standard or obsidian.", { path: configPath, line: 1, column: 1 }));
  if (identity.strategy !== undefined && identity.strategy !== "uuidv7") diagnostics.push(diagnostic("KB001", "error", "identity.strategy must be uuidv7.", { path: configPath, line: 1, column: 1 }));
  if (imports.allow_outside_project === true || imports.allow_symlink_escape === true) diagnostics.push(diagnostic("KB001", "error", "v0.1 cannot allow project-boundary or symlink escape.", { path: configPath, line: 1, column: 1 }));
  if (mentions.mutate_source === true) diagnostics.push(diagnostic("KB001", "error", "mentions.mutate_source must be false.", { path: configPath, line: 1, column: 1 }));
  if (server.host !== undefined && server.host !== "127.0.0.1") diagnostics.push(diagnostic("KB001", "error", "The v0.1 default server host must be 127.0.0.1.", { path: configPath, line: 1, column: 1 }));
  if (diagnostics.some((item) => item.severity === "error")) return { root, path: configAbsolutePath, raw, diagnostics };

  const maxDepth = typeof retrieval.max_depth === "number" ? retrieval.max_depth : 3;
  const config: ProjectConfig = {
    spec: "0.1",
    project: {
      id: project.id as string,
      slug: project.slug as string,
      title: project.title as string,
      ...(typeof project.language === "string" ? { language: project.language } : {}),
    },
    content: {
      roots: roots!,
      include: stringArray(content.include) ?? ["**/*.md"],
      exclude: stringArray(content.exclude) ?? [],
      dialect: content.dialect === "obsidian" ? "obsidian" : "standard",
    },
    identity: {
      strategy: "uuidv7",
      require_document_id: identity.require_document_id !== false,
    },
    imports: {
      allow_outside_project: false,
      allow_symlink_escape: false,
      warn_unused: imports.warn_unused !== false,
    },
    mentions: {
      enabled: mentions.enabled === true,
      mode: "imported-labels",
      strength: "weak",
      mutate_source: false,
    },
    retrieval: {
      default_depth: typeof retrieval.default_depth === "number" ? retrieval.default_depth : 1,
      max_depth: maxDepth,
      default_token_budget: typeof retrieval.default_token_budget === "number" ? retrieval.default_token_budget : 6000,
      max_documents: typeof retrieval.max_documents === "number" ? retrieval.max_documents : 16,
      semantic_search: retrieval.semantic_search === "disabled" ? "disabled" : "optional",
    },
    build: {
      output: typeof build.output === "string" ? build.output : ".knowledge/dist",
      emit: stringArray(build.emit) ?? ["markdown", "json", "graph"],
    },
    server: {
      host: "127.0.0.1",
      port: typeof server.port === "number" ? server.port : 4317,
    },
  };
  if (!Number.isInteger(config.retrieval.default_depth) || !Number.isInteger(maxDepth) || config.retrieval.default_depth < 0 || maxDepth < config.retrieval.default_depth) {
    diagnostics.push(diagnostic("KB001", "error", "retrieval depths must be non-negative integers and default_depth must not exceed max_depth.", { path: configPath, line: 1, column: 1 }));
  }
  if (!Number.isInteger(config.retrieval.default_token_budget) || config.retrieval.default_token_budget < 1 || !Number.isInteger(config.retrieval.max_documents) || config.retrieval.max_documents < 1) {
    diagnostics.push(diagnostic("KB001", "error", "retrieval budgets and limits must be positive integers.", { path: configPath, line: 1, column: 1 }));
  }
  return { root, path: configAbsolutePath, raw, config, diagnostics };
}
