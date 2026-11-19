import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(pkgRoot, "../..");

const mod = await import("../dist/index.js");
const schema = z.toJSONSchema(mod.AstRootSchema);
schema.$id = "https://spica.simway.io/schema/adm.json";
schema.title = "Spica Open ADM Specification";
schema.description = "The canonical schema defining Application Domain Models (ADM) for Spec-Driven Development (SDD).";

const jsonStr = JSON.stringify(schema, null, 2) + "\n";
const target = path.resolve(repoRoot, "schemas/adm.json");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, jsonStr, "utf8");
console.log("Generated single canonical JSON Schema in schemas/adm.json");

// Ensure CLI binary has executable permission cross-platform on POSIX without shell chmod command
const cliPath = path.resolve(pkgRoot, "dist/cli.js");
if (fs.existsSync(cliPath)) {
  try {
    fs.chmodSync(cliPath, 0o755);
  } catch {}
}
