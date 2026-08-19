import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileProject } from "./compiler.ts";
import { loadIdentitySidecar, writeIdentitySidecar } from "./identity.ts";
import { generateUuidV7 } from "./util.ts";

async function exists(value: string): Promise<boolean> {
  try {
    await lstat(value);
    return true;
  } catch {
    return false;
  }
}

function slugFromDirectory(root: string): string {
  const slug = path.basename(root).normalize("NFKD").toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug || "knowledge-project";
}

export interface InitProjectResult {
  root: string;
  configPath: string;
  identityPath?: string;
  projectId: string;
}

export type ProjectPreset = "standard" | "obsidian";

export async function initProject(inputRoot: string, preset: ProjectPreset = "standard"): Promise<InitProjectResult> {
  if (preset !== "standard" && preset !== "obsidian") throw new Error(`Unknown preset '${preset}'.`);
  const root = await realpath(path.resolve(inputRoot));
  const configPath = path.join(root, ".knowledge", "project.yaml");
  if (await exists(configPath)) throw new Error("Refusing to overwrite existing .knowledge/project.yaml.");
  const projectId = generateUuidV7();
  const slug = slugFromDirectory(root);
  const title = path.basename(root);
  const isObsidian = preset === "obsidian";
  const config = `spec: "0.1"\n\nproject:\n  id: "${projectId}"\n  slug: "${slug}"\n  title: "${title.replaceAll('"', '\\"')}"\n\ncontent:\n  roots:\n    - "."\n  include:\n    - "**/*.md"\n  exclude:\n    - ".knowledge/**"\n    - ".obsidian/**"\n  dialect: "${preset}"\n\nidentity:\n  strategy: "uuidv7"\n  require_document_id: ${isObsidian ? "false" : "true"}\n\nimports:\n  allow_outside_project: false\n  allow_symlink_escape: false\n  warn_unused: true\n\nmentions:\n  enabled: ${isObsidian ? "false" : "true"}\n  mode: "imported-labels"\n  strength: "weak"\n  mutate_source: false\n\nretrieval:\n  default_depth: 1\n  max_depth: 3\n  default_token_budget: 6000\n  max_documents: 16\n  semantic_search: "optional"\n\nbuild:\n  output: ".knowledge/dist"\n  emit:\n    - "markdown"\n    - "json"\n    - "graph"\n    - "site"\n    - "llms-txt"\n\nserver:\n  host: "127.0.0.1"\n  port: 4317\n`;
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, config, { encoding: "utf8", flag: "wx" });
  if (isObsidian) {
    const identityPath = await writeIdentitySidecar(root, { version: "0.1", documents: {} });
    return { root, configPath, identityPath, projectId };
  }
  return { root, configPath, projectId };
}

export interface AdoptProjectResult {
  identityPath: string;
  added: number;
  total: number;
}

export async function adoptProject(inputRoot: string): Promise<AdoptProjectResult> {
  const result = await compileProject(inputRoot);
  if (!result.project) throw new Error("Cannot adopt documents until the project configuration is valid.");
  if (result.project.config.content.dialect !== "obsidian" || result.project.config.identity.require_document_id) {
    throw new Error("adopt requires content.dialect: obsidian and identity.require_document_id: false.");
  }
  const sidecar = await loadIdentitySidecar(result.project.root);
  let added = 0;
  for (const document of result.project.documents) {
    if (document.id || sidecar.documents[document.path]) continue;
    sidecar.documents[document.path] = generateUuidV7();
    added += 1;
  }
  const identityPath = await writeIdentitySidecar(result.project.root, sidecar);
  return { identityPath, added, total: Object.keys(sidecar.documents).length };
}
