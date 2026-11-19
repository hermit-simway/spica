import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { runCli, buildScaffoldModel, toPascalCase } from "../src/cli.js";
import { validateAdm } from "../src/admValidator.js";

const TMP_DIR = path.resolve(__dirname, ".tmp-scaffold");

describe("spica new (scaffold)", () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("toPascalCase normalizes identifiers", () => {
    expect(toPascalCase("order-fulfillment")).toBe("OrderFulfillment");
    expect(toPascalCase("order_fulfillment")).toBe("OrderFulfillment");
    expect(toPascalCase("OrderFulfillment")).toBe("OrderFulfillment");
    expect(toPascalCase("billing")).toBe("Billing");
  });

  it("buildScaffoldModel produces a valid, non-anemic model out of the box", () => {
    const model = buildScaffoldModel({ domain: "order-fulfillment", createdAt: "2026-11-16T00:00:00Z" });
    expect(model.domainName).toBe("OrderFulfillment");
    expect(model.$schema).toBe("https://spica.simway.io/schema/adm.json");
    expect(model.specVersion).toBe("0.0.0");
    expect(model.createdAt).toBe("2026-11-16T00:00:00Z");
    expect(model.aggregates).toHaveLength(1);

    const agg = model.aggregates[0];
    expect(agg.states.length).toBeGreaterThan(0);
    expect(agg.rootEntity).toBe(agg.name);
    expect(agg.entities?.find((e) => e.name === agg.rootEntity)).toBeTruthy();

    const result = validateAdm(model);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("scaffolds a default file under .spica/ in the current working directory", () => {
    const dir = path.join(TMP_DIR, "cwd");
    fs.mkdirSync(dir, { recursive: true });
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const code = runCli(["new", "order-fulfillment"]);
      expect(code).toBe(0);
      const file = path.join(dir, ".spica", "OrderFulfillment.adm.json");
      expect(fs.existsSync(file)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      expect(parsed.domainName).toBe("OrderFulfillment");
      expect(validateAdm(parsed).valid).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it("writes to a custom output directory with --out", () => {
    const targetDir = path.join(TMP_DIR, "specs");
    const code = runCli(["new", "billing", "--out", targetDir]);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(targetDir, "Billing.adm.json"))).toBe(true);
  });

  it("writes to an explicit file path when --out ends in .json", () => {
    const targetFile = path.join(TMP_DIR, "custom-name.adm.json");
    const code = runCli(["new", "billing", "--out", targetFile]);
    expect(code).toBe(0);
    expect(fs.existsSync(targetFile)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    expect(parsed.domainName).toBe("Billing");
  });

  it("respects --title, --actor, and --aggregate overrides", () => {
    const targetFile = path.join(TMP_DIR, "override.adm.json");
    const code = runCli([
      "new", "order-fulfillment",
      "--out", targetFile,
      "--title", "Fulfillment Engine",
      "--actor", "WarehouseClerk",
      "--aggregate", "Shipment",
    ]);
    expect(code).toBe(0);

    const parsed = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    expect(parsed.systemName).toBe("Fulfillment Engine");
    expect(parsed.actors[0].name).toBe("WarehouseClerk");
    expect(parsed.aggregates[0].name).toBe("Shipment");
    expect(parsed.aggregates[0].rootEntity).toBe("Shipment");
    expect(validateAdm(parsed).valid).toBe(true);
  });

  it("guards against overwriting an existing file without --force", () => {
    const targetFile = path.join(TMP_DIR, "guard.adm.json");
    fs.writeFileSync(targetFile, "CUSTOM", "utf-8");

    const code = runCli(["new", "billing", "--out", targetFile]);
    expect(code).toBe(1);
    expect(fs.readFileSync(targetFile, "utf-8")).toBe("CUSTOM");
  });

  it("overwrites an existing file with --force", () => {
    const targetFile = path.join(TMP_DIR, "force.adm.json");
    fs.writeFileSync(targetFile, "CUSTOM", "utf-8");

    const code = runCli(["new", "billing", "--out", targetFile, "--force"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
    expect(parsed.domainName).toBe("Billing");
  });

  it("emits machine-readable JSON with --json", () => {
    const targetFile = path.join(TMP_DIR, "json-out.adm.json");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = runCli(["new", "billing", "--out", targetFile, "--json"]);
    const output = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    logSpy.mockRestore();

    expect(code).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.domain).toBe("Billing");
    expect(parsed.validated).toBe(true);
    expect(parsed.path).toBe(targetFile);
    expect(fs.existsSync(targetFile)).toBe(true);
  });

  it("returns exit code 1 when domain is missing and stdin is not a TTY", () => {
    const code = runCli(["new"]);
    expect(code).toBe(1);
  });
});
