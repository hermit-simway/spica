import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AstRoot } from "../src/schema.js";
import { validateAdm } from "../src/admValidator.js";
import { projectSystemContextDiagram, projectDomainAggregateMap } from "../src/diagramProjector.js";
import { projectDddCrewMarkdown } from "../src/dddCrewProjector.js";
import { parseDddCrewMarkdown, DddCrewParseError } from "../src/dddCrewParser.js";
import { projectOpenApi3Spec, toPluralKebab, toKebabCase } from "../src/openApiProjector.js";
import { projectDddCrewExcalidraw } from "../src/excalidrawProjector.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Milestone 1 — 4-Lens Contract Engine & Ingestion Suite", () => {
  const libraryFixturePath = path.join(__dirname, "fixtures", "canonical-library.adm.json");
  const libraryAdm: AstRoot = JSON.parse(fs.readFileSync(libraryFixturePath, "utf8"));

  // [M1-CORE-01]
  describe("[M1-CORE-01] Lens 1: C4 System Context Technology Badges", () => {
    it("should include derived or explicit technology tags in Rel(...) bindings", () => {
      const diagram = projectSystemContextDiagram(libraryAdm);
      expect(diagram).toContain("C4Context");
      expect(diagram).toContain('System(publicLibrarySystem, "Public Library System"');
      expect(diagram).toContain('System_Ext(notificationGateway, "NotificationGateway"');
      // RelationshipNode: "Sends pickup notices via async events" -> should derive "Async Event"
      expect(diagram).toMatch(/Rel\(publicLibrarySystem, notificationGateway, "[^"]+", "Async Event"\)/);
    });
  });

  // [M1-CORE-02]
  describe("[M1-CORE-02] Lens 2: Cross-AggregateNode Event Flow Edges", () => {
    it("should emit styled cross-aggregate event edges when commands or policies react to external events", () => {
      const cloned: AstRoot = JSON.parse(JSON.stringify(libraryAdm));
      // Give Loan.CheckoutBook an explicit triggerEvent from Hold
      cloned.aggregates[3].commands[0].triggerEvent = "Hold.HoldCompleted";

      const mapDiagram = projectDomainAggregateMap(cloned);
      expect(mapDiagram).toContain("graph TD");
      expect(mapDiagram).toContain('Hold ==>|"triggers on HoldCompleted"| Loan');
    });
  });

  // [M1-CORE-03] & [M1-CORE-04]
  describe("[M1-CORE-03] & [M1-CORE-04] Lens 3: DDD Crew Markdown Projector & Parser", () => {
    it("should project AstRoot into clean DDD Crew markdown format", () => {
      const markdown = projectDddCrewMarkdown(libraryAdm);
      expect(markdown).toContain("# Aggregate Design Canvas: PublicLibraryCirculation");
      expect(markdown).toContain("## Context & Metadata");
      expect(markdown).toContain("- **Domain:** PublicLibraryCirculation");
      expect(markdown).toContain("### System Actors");
      expect(markdown).toContain("| Patron |");
      expect(markdown).toContain("# AggregateNode: Patron");
      expect(markdown).toContain("## 1. Name");
      expect(markdown).toContain("- **Root EntityNode:** Patron");
      expect(markdown).toContain("## 2. Description");
      expect(markdown).toContain("## 3. State Transitions");
      expect(markdown).toContain("## 4. Enforced Invariants");
      expect(markdown).toContain("## 5. Corrective Policies");
      expect(markdown).toContain("## 6. Handled Commands");
      expect(markdown).toContain("## 7. Created Events");
      expect(markdown).toContain("## 8. Throughput");
      expect(markdown).toContain("## 9. Size");
      expect(markdown).toContain("stateDiagram-v2");
    });

    it("should parse projected DDD Crew markdown back into a valid AstRoot (100% roundtrip fidelity)", () => {
      const markdown = projectDddCrewMarkdown(libraryAdm);
      const parsed = parseDddCrewMarkdown(markdown);

      // Verify schema validity of parsed model
      const validation = validateAdm(parsed);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify domain and metadata roundtrip
      expect(parsed.domainName).toBe(libraryAdm.domainName);
      expect(parsed.systemName).toBe(libraryAdm.systemName);
      expect(parsed.systemDescription).toBe(libraryAdm.systemDescription);
      expect(parsed.specVersion).toBe(libraryAdm.specVersion);
      expect(parsed.author).toBe(libraryAdm.author);

      // Verify actors roundtrip
      expect(parsed.actors).toHaveLength(libraryAdm.actors?.length || 0);
      expect(parsed.actors?.[0].name).toBe("Patron");
      expect(parsed.actors?.[1].name).toBe("Librarian");

      // Verify aggregates roundtrip
      expect(parsed.aggregates).toHaveLength(libraryAdm.aggregates.length);

      for (let i = 0; i < libraryAdm.aggregates.length; i++) {
        const expectedAgg = libraryAdm.aggregates[i];
        const actualAgg = parsed.aggregates[i];

        expect(actualAgg.name).toBe(expectedAgg.name);
        expect(actualAgg.rootEntity).toBe(expectedAgg.rootEntity);

        const expectedStates = expectedAgg.states || [];
        const actualStates = actualAgg.states || [];
        expect(actualStates).toEqual(expectedStates);

        // Entities & Fields
        expect(actualAgg.entities).toHaveLength(expectedAgg.entities.length);
        for (let e = 0; e < expectedAgg.entities.length; e++) {
          expect(actualAgg.entities[e].name).toBe(expectedAgg.entities[e].name);
          expect(actualAgg.entities[e].fields).toHaveLength(expectedAgg.entities[e].fields.length);
          for (let f = 0; f < expectedAgg.entities[e].fields.length; f++) {
            expect(actualAgg.entities[e].fields[f].name).toBe(expectedAgg.entities[e].fields[f].name);
            expect(actualAgg.entities[e].fields[f].type).toBe(expectedAgg.entities[e].fields[f].type);
            expect(actualAgg.entities[e].fields[f].required).toBe(expectedAgg.entities[e].fields[f].required);
          }
        }

        // Commands
        expect(actualAgg.commands).toHaveLength(expectedAgg.commands.length);
        for (let c = 0; c < expectedAgg.commands.length; c++) {
          const expectedCmd = expectedAgg.commands[c];
          const actualCmd = actualAgg.commands[c];
          expect(actualCmd.name).toBe(expectedCmd.name);
          expect(actualCmd.actor).toBe(expectedCmd.actor);
          expect(Boolean(actualCmd.isCreation)).toBe(Boolean(expectedCmd.isCreation));
          expect(actualCmd.requiredState).toBe(expectedCmd.requiredState || "");
          expect(actualCmd.targetState).toBe(expectedCmd.targetState || undefined);
          expect(actualCmd.parameters?.length).toBe(expectedCmd.parameters?.length || 0);
        }

        // Reducers
        if (expectedAgg.reducers && expectedAgg.reducers.length > 0) {
          expect(actualAgg.reducers).toBeDefined();
          expect(actualAgg.reducers).toHaveLength(expectedAgg.reducers.length);
          expect(actualAgg.reducers![0]).toEqual(expectedAgg.reducers[0]);
        }
      }
    });

    it("should throw E_DDD_CREW_PARSE_ERROR on empty or invalid markdown", () => {
      expect(() => parseDddCrewMarkdown("")).toThrow(DddCrewParseError);
      expect(() => parseDddCrewMarkdown("# Empty Document Without Aggregates")).toThrow(DddCrewParseError);
    });

    it("should safely project ADM models with missing or optional fields without throwing replace errors", () => {
      const sparseAdm: any = {
        domain: "SparseDomain",
        createdAt: "2026-10-28T00:00:00Z",
        aggregates: [
          {
            name: "Order",
            rootEntity: "Order",
            entities: [
              {
                name: "Order",
                fields: [{ name: "$id", type: "string" }]
              }
            ],
            commands: [
              {
                name: "SubmitOrder"
                // actor and other optional fields are intentionally omitted
              }
            ]
          }
        ]
      };

      expect(() => projectDddCrewMarkdown(sparseAdm)).not.toThrow();
      const md = projectDddCrewMarkdown(sparseAdm);
      expect(md).toContain("# AggregateNode: Order");
      expect(md).toContain("SubmitOrder");
      expect(md).toContain("User");
    });
  });

  // [M1-CORE-05]
  describe("[M1-CORE-05] Lens 4: OpenAPI 3.0 Specification Projector", () => {
    it("should project AstRoot into a compliant OpenAPI 3.0.3 specification", () => {
      const openapi = projectOpenApi3Spec(libraryAdm) as any;

      expect(openapi.openapi).toBe("3.0.3");
      expect(openapi.info.title).toBe("Public Library System");
      expect(openapi.info.version).toBe("0.0.0");
      expect(openapi.info.description).toBe("Manages book catalog, patron circulation, active holds, and overdue fines.");

      // Check schemas
      expect(openapi.components.schemas).toBeDefined();
      expect(openapi.components.schemas["Patron"]).toBeDefined();
      expect(openapi.components.schemas["RegisterPatronRequest"]).toBeDefined();
      expect(openapi.components.schemas["PayFeeRequest"]).toBeDefined();
      expect(openapi.components.schemas["InvariantViolation"]).toBeDefined();
      expect(openapi.components.schemas["AggregateNotFound"]).toBeDefined();

      // Check paths
      expect(openapi.paths["/api/patrons"]).toBeDefined();
      expect(openapi.paths["/api/patrons"]["post"]).toBeDefined();
      expect(openapi.paths["/api/patrons"]["post"].operationId).toBe("RegisterPatron");

      // Query endpoint
      expect(openapi.paths["/api/patrons/{id}"]).toBeDefined();
      expect(openapi.paths["/api/patrons/{id}"]["get"]).toBeDefined();

      // Mutation endpoint
      expect(openapi.paths["/api/patrons/{id}/pay-fee"]).toBeDefined();
      expect(openapi.paths["/api/patrons/{id}/pay-fee"]["post"]).toBeDefined();
      expect(openapi.paths["/api/patrons/{id}/pay-fee"]["post"].operationId).toBe("PayFee");

      // BookCopy
      expect(openapi.paths["/api/book-copies"]).toBeDefined();
      expect(openapi.paths["/api/book-copies"]["post"].operationId).toBe("RegisterBookCopy");

      // Hold
      expect(openapi.paths["/api/holds"]).toBeDefined();
      expect(openapi.paths["/api/holds/{id}/cancel-hold"]).toBeDefined();

      // Loan
      expect(openapi.paths["/api/loans"]).toBeDefined();
      expect(openapi.paths["/api/loans/{id}/return-book"]).toBeDefined();
    });

    it("should helper pluralize and kebab-case aggregate names accurately", () => {
      expect(toKebabCase("RegisterPatron")).toBe("register-patron");
      expect(toKebabCase("PayFee")).toBe("pay-fee");
      expect(toPluralKebab("Patron")).toBe("patrons");
      expect(toPluralKebab("BookCopy")).toBe("book-copies");
      expect(toPluralKebab("Hold")).toBe("holds");
      expect(toPluralKebab("Address")).toBe("addresses");
      expect(toPluralKebab("Branch")).toBe("branches");
    });
  });

  // [M1-CORE-05] Lens 3: Excalidraw Aggregate Design Canvas Projector
  describe("[M1-CORE-05] Lens 3: Excalidraw Aggregate Design Canvas Generator", () => {
    it("should project ADM models into valid Excalidraw v2 document conforming to DDD Crew Canvas v1.1", () => {
      const excalidrawDoc = projectDddCrewExcalidraw(libraryAdm);
      expect(excalidrawDoc.type).toBe("excalidraw");
      expect(excalidrawDoc.version).toBe(2);
      expect(excalidrawDoc.source).toBe("https://excalidraw-jetbrains-plugin");
      expect(Array.isArray(excalidrawDoc.elements)).toBe(true);
      expect(excalidrawDoc.elements.length).toBeGreaterThan(50);

      // Verify presence of all 4 aggregates from canonical library
      const allText = excalidrawDoc.elements
        .filter((el) => el.type === "text" && el.text)
        .map((el) => el.text)
        .join(" ");

      expect(allText).toContain("Aggregate Design Canvas: Patron");
      expect(allText).toContain("Aggregate Design Canvas: BookCopy");
      expect(allText).toContain("Aggregate Design Canvas: Hold");
      expect(allText).toContain("Aggregate Design Canvas: Loan");

      // Verify 9-box section headers
      expect(allText).toContain("1. Name:");
      expect(allText).toContain("2. Description:");
      expect(allText).toContain("3. State Transitions:");
      expect(allText).toContain("4. Enforced Invariants:");
      expect(allText).toContain("5. Corrective Policies");
      expect(allText).toContain("6. Handled Commands:");
      expect(allText).toContain("7. Created Events:");
      expect(allText).toContain("8. Throughput:");
      expect(allText).toContain("9. Size");

      // Verify DDD Crew attribution footer
      expect(allText).toContain("Aggregate Design Canvas V1.1 by Kacper Gunia & Domain-Driven Design Crew");
    });
  });
});

