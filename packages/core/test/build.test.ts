import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli } from "../src/cli.js";

const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "canonical-library.adm.json");
const TMP_DIR = path.resolve(__dirname, ".tmp-build");

describe("Spica CLI (spica build)", () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("emits all lenses to standard paths on a valid ADM and returns 0", () => {
    const outDir = path.join(TMP_DIR, "dist");
    const code = runCli(["build", FIXTURE_PATH, "-o", outDir]);

    expect(code).toBe(0);

    // OpenAPI 3.0.3 contract
    const openapiPath = path.join(outDir, "openapi.json");
    expect(fs.existsSync(openapiPath)).toBe(true);
    const openapi = JSON.parse(fs.readFileSync(openapiPath, "utf-8"));
    expect(openapi.openapi).toBe("3.0.3");

    // AWS Kiro specs under .kiro/specs/<domain>/
    const kiroDir = path.join(outDir, ".kiro", "specs", "public-library-system");
    expect(fs.existsSync(path.join(kiroDir, "requirements.md"))).toBe(true);
    expect(fs.existsSync(path.join(kiroDir, "design.md"))).toBe(true);
    expect(fs.existsSync(path.join(kiroDir, "tasks.md"))).toBe(true);

    // Mermaid diagrams
    expect(fs.existsSync(path.join(outDir, "docs", "diagrams", "system-context.mmd"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "docs", "diagrams", "domain-map.mmd"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "docs", "diagrams", "class-diagram.mmd"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "docs", "diagrams", "state-machine.mmd"))).toBe(true);

    // DDD Crew Aggregate Canvas
    expect(fs.existsSync(path.join(outDir, "docs", "canvas", "aggregate-canvas.md"))).toBe(true);

    // Content spot-checks
    const domainMap = fs.readFileSync(path.join(outDir, "docs", "diagrams", "domain-map.mmd"), "utf-8");
    expect(domainMap).toContain("graph TD");

    const systemContext = fs.readFileSync(path.join(outDir, "docs", "diagrams", "system-context.mmd"), "utf-8");
    expect(systemContext).toContain("C4Context");

    const classDiagram = fs.readFileSync(path.join(outDir, "docs", "diagrams", "class-diagram.mmd"), "utf-8");
    expect(classDiagram).toContain("classDiagram");

    const stateMachine = fs.readFileSync(path.join(outDir, "docs", "diagrams", "state-machine.mmd"), "utf-8");
    expect(stateMachine).toContain("stateDiagram-v2");
  });

  it("fails on invalid ADM with exit code 1 and emits no artifacts", () => {
    const invalidFile = path.join(TMP_DIR, "invalid.adm.json");
    fs.writeFileSync(invalidFile, JSON.stringify({ domainName: "Broken" }), "utf-8");

    const outDir = path.join(TMP_DIR, "dist");
    const code = runCli(["build", invalidFile, "-o", outDir]);

    expect(code).toBe(1);
    // No lenses should be emitted on validation failure.
    expect(fs.existsSync(path.join(outDir, "openapi.json"))).toBe(false);
    expect(fs.existsSync(path.join(outDir, ".kiro"))).toBe(false);
    expect(fs.existsSync(path.join(outDir, "docs"))).toBe(false);
  });

  it("returns exit code 1 when no ADM file is discoverable", () => {
    const dir = path.join(TMP_DIR, "empty");
    fs.mkdirSync(dir, { recursive: true });
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const code = runCli(["build"]);
      expect(code).toBe(1);
    } finally {
      process.chdir(prev);
    }
  });

  it("auto-discovers .spica/*.adm.json when no file arg is given", () => {
    const dir = path.join(TMP_DIR, "auto-spica");
    const spicaDir = path.join(dir, ".spica");
    fs.mkdirSync(spicaDir, { recursive: true });
    fs.copyFileSync(FIXTURE_PATH, path.join(spicaDir, "my-domain.adm.json"));

    const prev = process.cwd();
    process.chdir(dir);
    try {
      const outDir = path.join(dir, "dist");
      const code = runCli(["build", "-o", "dist"]);
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(outDir, "openapi.json"))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it("falls back to ./*.adm.json when .spica/ is absent", () => {
    const dir = path.join(TMP_DIR, "auto-root");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(FIXTURE_PATH, path.join(dir, "root.adm.json"));

    const prev = process.cwd();
    process.chdir(dir);
    try {
      const outDir = path.join(dir, "dist");
      const code = runCli(["build", "-o", "dist"]);
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(outDir, "openapi.json"))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it("errors when .spica/ holds multiple ADM files", () => {
    const dir = path.join(TMP_DIR, "auto-ambiguous");
    const spicaDir = path.join(dir, ".spica");
    fs.mkdirSync(spicaDir, { recursive: true });
    fs.copyFileSync(FIXTURE_PATH, path.join(spicaDir, "a.adm.json"));
    fs.copyFileSync(FIXTURE_PATH, path.join(spicaDir, "b.adm.json"));

    const prev = process.cwd();
    process.chdir(dir);
    try {
      const code = runCli(["build"]);
      expect(code).toBe(1);
    } finally {
      process.chdir(prev);
    }
  });

  it("supports --json and reports the emitted file list", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const outDir = path.join(TMP_DIR, "dist");
    const code = runCli(["build", FIXTURE_PATH, "-o", outDir, "--json"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    const report = JSON.parse(output);
    expect(report.domain).toBe("PublicLibraryCirculation");
    expect(report.files).toContain("openapi.json");
    expect(report.files).toContain("docs/diagrams/system-context.mmd");
    expect(report.files).toContain("docs/canvas/aggregate-canvas.md");
  });
});
