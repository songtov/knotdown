import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import type { Diagnostic, SourceLocation } from "./types.ts";

export const CORE_VERSION = "knotdown-core-0.1";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

export function relativePosix(root: string, value: string): string {
  return toPosix(path.relative(root, value));
}

export function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function normalizeLabel(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");
}

export function estimateTokens(value: string): number {
  return value.length === 0 ? 0 : Math.max(1, Math.ceil(value.length / 4));
}

export function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableValue(record[key])]));
  }
  return value;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

const severityRank: Record<Diagnostic["severity"], number> = { error: 0, warning: 1 };

export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) =>
    severityRank[a.severity] - severityRank[b.severity]
    || a.source.path.localeCompare(b.source.path)
    || a.source.line - b.source.line
    || a.source.column - b.source.column
    || a.code.localeCompare(b.code)
    || a.message.localeCompare(b.message));
}

export function diagnostic(code: string, severity: Diagnostic["severity"], message: string, source: SourceLocation): Diagnostic {
  return { code, severity, message, source };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function isUuidV7(value: unknown): value is string {
  return isUuid(value) && value[14]?.toLowerCase() === "7";
}

export function generateUuidV7(timestamp = Date.now()): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 0xffffffffffff) throw new Error("UUIDv7 timestamp is out of range.");
  const bytes = randomBytes(16);
  let value = BigInt(timestamp);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
