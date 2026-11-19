import { describe, it, expect } from "vitest";
import {
  parseDddCrewMarkdown,
  projectDddCrewMarkdown,
  projectOpenApi3Spec,
  projectKiroSpec,
  validateAdm,
  type AstRoot
} from "@simway/spica";
import { CANONICAL_LIBRARY_MODEL } from "../sampleModel";
import { buildDriftModel } from "../lib/drift";

describe("Spica Studio — canonical model", () => {
  it("validates the Canonical Public Library ADM with zero errors", () => {
    const result = validateAdm(CANONICAL_LIBRARY_MODEL);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.model).toBeDefined();
    expect(result.model?.domainName).toBe("PublicLibraryCirculation");
  });

  it("declares all four aggregates with canonical states", () => {
    expect(CANONICAL_LIBRARY_MODEL.aggregates.map((a) => a.name)).toEqual([
      "Patron",
      "BookCopy",
      "Hold",
      "Loan"
    ]);
    for (const agg of CANONICAL_LIBRARY_MODEL.aggregates) {
      expect(agg.states.length).toBeGreaterThan(0);
    }
  });
});

describe("DDD Crew Markdown round-trip", () => {
  it("projects then parses back to a schema-valid AstRoot", () => {
    const markdown = projectDddCrewMarkdown(CANONICAL_LIBRARY_MODEL);
    expect(markdown).toContain("# Aggregate Design Canvas");

    const reparsed = parseDddCrewMarkdown(markdown);
    const result = validateAdm(reparsed);
    expect(result.valid).toBe(true);
    expect(reparsed.aggregates.map((a) => a.name)).toEqual([
      "Patron",
      "BookCopy",
      "Hold",
      "Loan"
    ]);
  });

  it("round-trips aggregate commands and states", () => {
    const markdown = projectDddCrewMarkdown(CANONICAL_LIBRARY_MODEL);
    const reparsed = parseDddCrewMarkdown(markdown);
    const patron = reparsed.aggregates.find((a) => a.name === "Patron");
    expect(patron).toBeDefined();
    expect(patron?.rootEntity).toBe("Patron");
    expect(patron?.states).toContain("Active");
    expect((patron?.commands ?? []).map((c) => c.name)).toContain("RegisterPatron");
  });
});

describe("OpenAPI 3.0 projection", () => {
  it("projects a valid OpenAPI 3.0.3 document", () => {
    const spec = projectOpenApi3Spec(CANONICAL_LIBRARY_MODEL);
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.paths).toBeDefined();
    expect(spec.components).toBeDefined();

    const paths = spec.paths as Record<string, Record<string, unknown>>;
    const keys = Object.keys(paths);
    expect(keys.some((k) => k.startsWith("/api/patrons"))).toBe(true);
  });
});

describe("Live diagnostics & *Id drift", () => {
  it("detects injected *Id drift and implicit root identity", () => {
    const drifted: AstRoot = buildDriftModel(CANONICAL_LIBRARY_MODEL);
    const result = validateAdm(drifted);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "E_UNRESOLVED_ENTITY_ID_REF")).toBe(true);
    expect(result.warnings.some((w) => w.code === "W_IMPLICIT_ROOT_ID")).toBe(true);
  });

  it("leaves the canonical model free of drift diagnostics", () => {
    const result = validateAdm(CANONICAL_LIBRARY_MODEL);
    expect(result.errors.some((e) => e.code === "E_UNRESOLVED_ENTITY_ID_REF")).toBe(false);
    expect(result.warnings.some((w) => w.code === "W_IMPLICIT_ROOT_ID")).toBe(false);
  });
});

describe("AWS Kiro Spec projection", () => {
  it("projects canonical library model to Kiro specs (.kiro/specs/)", () => {
    const kiro = projectKiroSpec(CANONICAL_LIBRARY_MODEL);
    expect(kiro.featureName).toBe("public-library-system");
    expect(kiro.files.requirements).toContain("#### Acceptance Criteria (EARS Syntax)");
    expect(kiro.files.design).toContain("graph TD");
    expect(kiro.files.tasks).toContain("## Phase 1: Core Domain Entities & Schemas");
    expect(kiro.aggregateSpecs["Patron"]).toBeDefined();
    expect(kiro.aggregateSpecs["Loan"]).toBeDefined();
  });
});
