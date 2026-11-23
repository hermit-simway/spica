import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

describe("CommonJS Export Compatibility", () => {
  const pkgDir = path.resolve(__dirname, "..");
  const pkgPath = path.join(pkgDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  it("declares types, import, require, and default conditions in exports", () => {
    expect(pkg.exports).toBeDefined();
    expect(pkg.exports["."]).toBeDefined();
    expect(pkg.exports["."].types).toBe("./dist/index.d.ts");
    expect(pkg.exports["."].import).toBe("./dist/index.js");
    expect(pkg.exports["."].require).toBe("./dist/index.js");
    expect(pkg.exports["."].default).toBe("./dist/index.js");
  });

  it("can be required by a CommonJS consumer via package resolution", () => {
    const distPath = path.join(pkgDir, "dist/index.js");
    if (!fs.existsSync(distPath)) {
      execFileSync("npm", ["run", "build"], { cwd: pkgDir, stdio: "inherit" });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spica-test-cjs-"));
    try {
      const modDir = path.join(tmpDir, "node_modules", "@simway");
      fs.mkdirSync(modDir, { recursive: true });
      fs.symlinkSync(pkgDir, path.join(modDir, "spica"), "junction");

      const testScript = path.join(tmpDir, "test.cjs");
      fs.writeFileSync(
        testScript,
        `
        const assert = require("node:assert");
        const spica = require("@simway/spica");
        assert(typeof spica.validateAdm === "function", "validateAdm must be exported");
        assert(typeof spica.AstRootSchema === "object", "AstRootSchema must be exported");
        console.log("CJS require successful");
        `
      );

      const stdout = execFileSync(process.execPath, [testScript], { encoding: "utf8" });
      expect(stdout).toContain("CJS require successful");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
