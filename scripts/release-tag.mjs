import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const packageJson = JSON.parse(await readFile(path.resolve(import.meta.dirname, "..", "package.json"), "utf8"));
const tag = process.argv[2];
assert.equal(tag, `v${packageJson.version}`, `Release tag must be v${packageJson.version}.`);
process.stdout.write(packageJson.version.includes("-") ? "next" : "latest");
