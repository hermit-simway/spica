import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, "../packages/core");

const corePkgPath = path.join(coreDir, "package.json");
const corePkg = JSON.parse(fs.readFileSync(corePkgPath, "utf8"));

// 1. Static exports verification
const exportsField = corePkg.exports?.["."];
if (!exportsField) {
  console.error("❌ packages/core/package.json is missing exports[\".\"]");
  process.exit(1);
}

const requiredKeys = ["types", "import", "require", "default"];
for (const key of requiredKeys) {
  if (!exportsField[key]) {
    console.error(`❌ packages/core/package.json exports["."] is missing key "${key}"`);
    process.exit(1);
  }
}

// 2. Dynamic runtime CJS require smoke test
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spica-cjs-smoke-"));
try {
  const modDir = path.join(tmpDir, "node_modules", "@simway");
  fs.mkdirSync(modDir, { recursive: true });
  fs.symlinkSync(coreDir, path.join(modDir, "spica"), "junction");

  const testScript = path.join(tmpDir, "smoke.cjs");
  fs.writeFileSync(
    testScript,
    `
    const assert = require("node:assert");
    const spica = require("@simway/spica");

    assert(typeof spica.validateAdm === "function", "validateAdm must be exported");
    assert(typeof spica.AstRootSchema === "object", "AstRootSchema must be exported");
    assert(typeof spica.defineAdm === "function", "defineAdm must be exported");
    console.log("✅ CommonJS consumer smoke test passed: @simway/spica resolved via require(). Exported symbols:", Object.keys(spica).length);
    `
  );

  const stdout = execFileSync(process.execPath, [testScript], { encoding: "utf8" });
  console.log(stdout.trim());
} catch (err) {
  console.error("❌ CommonJS consumer smoke test failed:", err.message);
  process.exit(1);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
