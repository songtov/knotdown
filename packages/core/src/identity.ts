import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isUuid, stableJson, toPosix } from "./util.ts";

export interface IdentitySidecar {
  version: "0.1";
  documents: Record<string, string>;
}

export const IDENTITY_SIDECAR_PATH = ".knowledge/identities.json";

function normalizedProjectPath(value: string): string | undefined {
  if (!value || path.isAbsolute(value)) return undefined;
  const normalized = toPosix(path.posix.normalize(toPosix(value)));
  return normalized === ".." || normalized.startsWith("../") ? undefined : normalized.replace(/^\.\//u, "");
}

export async function loadIdentitySidecar(root: string): Promise<IdentitySidecar> {
  const target = path.join(root, IDENTITY_SIDECAR_PATH);
  let raw: string;
  try {
    raw = await readFile(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: "0.1", documents: {} };
    throw error;
  }
  const value = JSON.parse(raw) as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Identity sidecar must be a JSON object.");
  const record = value as Record<string, unknown>;
  if (record.version !== "0.1" || record.documents === null || typeof record.documents !== "object" || Array.isArray(record.documents)) {
    throw new Error("Identity sidecar must contain version '0.1' and a documents object.");
  }
  const documents: Record<string, string> = {};
  for (const [rawPath, id] of Object.entries(record.documents as Record<string, unknown>)) {
    const projectPath = normalizedProjectPath(rawPath);
    if (!projectPath || !isUuid(id)) throw new Error(`Invalid identity sidecar entry '${rawPath}'.`);
    documents[projectPath] = id;
  }
  return { version: "0.1", documents };
}

export async function writeIdentitySidecar(root: string, sidecar: IdentitySidecar): Promise<string> {
  const directory = path.join(root, ".knowledge");
  const target = path.join(root, IDENTITY_SIDECAR_PATH);
  const temporary = path.join(directory, `.identities-${process.pid}.tmp`);
  await mkdir(directory, { recursive: true });
  const documents = Object.fromEntries(Object.entries(sidecar.documents).sort(([left], [right]) => left.localeCompare(right)));
  await writeFile(temporary, stableJson({ version: "0.1", documents }), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return target;
}
