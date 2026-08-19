import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "packages", "cli", "src", "main.ts");
const examples = [
  "examples/knotdown-project",
  "examples/research-project",
  "examples/obsidian-vault/product-alpha",
];

for (const example of examples) {
  const result = spawnSync(process.execPath, [cli, "build", example], { cwd: root, encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
