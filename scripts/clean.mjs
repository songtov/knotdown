import { rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.resolve(root, "dist");

if (target !== path.join(root, "dist")) throw new Error("Refusing to clean an unexpected path.");
await rm(target, { force: true, recursive: true });
