import { AstRoot, AggregateNode } from "./schema.js";

function escapeTableCell(str: unknown): string {
  if (str === undefined || str === null) return "";
  return String(str).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Derives a clean stateDiagram-v2 Mermaid block from an aggregate's states and commands.
 */
function generateStateDiagram(agg: AggregateNode): string {
  const lines: string[] = ["```mermaid", "stateDiagram-v2"];
  const states = agg.states || [];
  
  // Transitions from explicit transitions list if present
  const explicitTransitions = agg.transitions ?? [];
  if (explicitTransitions && explicitTransitions.length > 0) {
    for (const t of explicitTransitions) {
      const from = t.fromState === "[*]" ? "[*]" : t.fromState;
      const to = t.toState;
      const guard = t.guardCondition ? ` [${t.guardCondition}]` : "";
      lines.push(`    ${from} --> ${to}: ${t.trigger}${guard}`);
    }
  } else {
    // Derive from commands
    for (const cmd of agg.commands ?? []) {
      if (cmd.isCreation && cmd.targetState) {
        lines.push(`    [*] --> ${cmd.targetState}: ${cmd.name}`);
      } else if (cmd.requiredState && cmd.targetState) {
        lines.push(`    ${cmd.requiredState} --> ${cmd.targetState}: ${cmd.name}`);
      }
    }
  }

  // If no transitions could be derived, list states
  if (lines.length === 2 && states.length > 0) {
    for (const state of states) {
      lines.push(`    [*] --> ${state}`);
    }
  }

  lines.push("```");
  return lines.join("\n");
}

/**
 * Projects a validated AstRoot into the canonical DDD Crew Aggregate Design Canvas Markdown format (v1.1).
 * Follows the official 9-box structure:
 *  1. Name
 *  2. Description
 *  3. State Transitions (with Mermaid state diagram)
 *  4. Enforced Invariants
 *  5. Corrective Policies
 *  6. Handled Commands
 *  7. Created Events
 *  8. Throughput
 *  9. Size
 */
export function projectDddCrewMarkdown(model: AstRoot): string {
  const lines: string[] = [];

  // Title & Macro Context
  lines.push(`# Aggregate Design Canvas: ${model.domainName}`);
  lines.push("");
  lines.push("## Context & Metadata");
  lines.push(`- **Domain:** ${model.domainName}`);
  if (model.systemName) {
    lines.push(`- **System Name:** ${model.systemName}`);
  }
  if (model.systemDescription) {
    lines.push(`- **System Description:** ${model.systemDescription}`);
  }
  lines.push(`- **Spec Version:** ${model.specVersion ?? "0.0.0"}`);
  if (model.author) {
    lines.push(`- **Author:** ${model.author}`);
  }
  lines.push(`- **Created At:** ${model.createdAt}`);
  lines.push("");

  // System Actors
  if (model.actors && model.actors.length > 0) {
    lines.push("### System Actors");
    lines.push("| Actor | Description |");
    lines.push("| --- | --- |");
    for (const rawActor of model.actors) {
      const actorName = typeof rawActor === "string" ? rawActor : rawActor?.name || "ActorNode";
      const actorDesc = typeof rawActor === "string" ? "" : rawActor?.description || "";
      lines.push(`| ${escapeTableCell(actorName)} | ${escapeTableCell(actorDesc)} |`);
    }
    lines.push("");
  }

  // External Systems
  if (model.externalSystems && model.externalSystems.length > 0) {
    lines.push("### External Systems");
    lines.push("| System | Description | Relationship | Technology |");
    lines.push("| --- | --- | --- | --- |");
    for (const rawExt of model.externalSystems) {
      const extName = typeof rawExt === "string" ? rawExt : rawExt?.name || "System";
      const extDesc = typeof rawExt === "string" ? "" : rawExt?.description || "";
      const extRel = typeof rawExt === "string" ? "" : rawExt?.relationship || "";
      const extTech = typeof rawExt === "string" ? "" : rawExt?.technology || "";
      lines.push(
        `| ${escapeTableCell(extName)} | ${escapeTableCell(extDesc)} | ${escapeTableCell(extRel)} | ${escapeTableCell(extTech)} |`
      );
    }
    lines.push("");
  }

  // Process Each AggregateNode via the Official 9-Box Canvas
  for (let i = 0; i < model.aggregates.length; i++) {
    const agg = model.aggregates[i];
    const states = agg.states || [];

    lines.push("---");
    lines.push("");
    lines.push(`# AggregateNode: ${agg.name}`);
    lines.push("");

    // --- Box 1: Name ---
    lines.push("## 1. Name");
    lines.push(`- **AggregateNode Name:** ${agg.name}`);
    lines.push(`- **Root EntityNode:** ${agg.rootEntity}`);
    lines.push("");

    lines.push("### Entities & Fields");
    lines.push("| Entity | Field | Type | Required | IsList | Description |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const entity of agg.entities ?? []) {
      for (const field of entity.fields) {
        lines.push(
          `| ${escapeTableCell(entity.name)} | ${escapeTableCell(field.name)} | ${escapeTableCell(field.type)} | ${field.required ? "Yes" : "No"} | ${field.isList ? "Yes" : "No"} | ${escapeTableCell(field.description || "")} |`
        );
      }
    }
    lines.push("");

    if (agg.valueObjects && agg.valueObjects.length > 0) {
      lines.push("### Value Objects");
      lines.push("| ValueObject | Field | Type | Required | IsList |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const vo of agg.valueObjects) {
        if (vo.fields && vo.fields.length > 0) {
          for (const field of vo.fields) {
            lines.push(
              `| ${escapeTableCell(vo.name)} | ${escapeTableCell(field.name)} | ${escapeTableCell(field.type)} | ${field.required ? "Yes" : "No"} | ${field.isList ? "Yes" : "No"} |`
            );
          }
        } else if (vo.values && vo.values.length > 0) {
          lines.push(
            `| ${escapeTableCell(vo.name)} | enum | ${escapeTableCell(vo.values.join(", "))} | Yes | No |`
          );
        }
      }
      lines.push("");
    }

    // --- Box 2: Description ---
    lines.push("## 2. Description");
    const desc = agg.description || `Consistency boundary for the ${agg.name} aggregate. Enforces invariants and coordinates state transitions for ${agg.rootEntity}.`;
    lines.push(desc);
    lines.push("");

    // --- Box 3: State Transitions ---
    lines.push("## 3. State Transitions");
    lines.push(`- **Lifecycle States:** ${states.length > 0 ? states.join(", ") : "Single State"}`);
    lines.push("");
    lines.push("### State Machine Diagram");
    lines.push(generateStateDiagram(agg));
    lines.push("");

    // Explicit Transitions table
    const explicitTransitions = agg.transitions ?? [];
    if (explicitTransitions && explicitTransitions.length > 0) {
      lines.push("### Transitions");
      lines.push("| Trigger | From State | To State | Guard Condition |");
      lines.push("| --- | --- | --- | --- |");
      for (const t of explicitTransitions) {
        lines.push(
          `| ${escapeTableCell(t.trigger)} | ${escapeTableCell(t.fromState)} | ${escapeTableCell(t.toState)} | ${escapeTableCell(t.guardCondition || "-")} |`
        );
      }
      lines.push("");
    }

    // --- Box 4: Enforced Invariants ---
    lines.push("## 4. Enforced Invariants");
    const allPolicies = agg.policies || [];
    if (allPolicies.length > 0) {
      lines.push("| Invariant / Policy | Description | Intent Trace |");
      lines.push("| --- | --- | --- |");
      for (const p of allPolicies) {
        lines.push(
          `| ${escapeTableCell(p.name)} | ${escapeTableCell(p.description)} | ${escapeTableCell(p.intentTrace || "-")} |`
        );
      }
    } else {
      lines.push(`- Enforces consistency for ${agg.rootEntity} lifecycle and identity invariants.`);
    }
    lines.push("");

    // --- Box 5: Corrective Policies ---
    lines.push("## 5. Corrective Policies");
    if (agg.reducers && agg.reducers.length > 0) {
      lines.push("### State Projection Reducers");
      lines.push("| Command | Target Field | Operation | Source Parameter |");
      lines.push("| --- | --- | --- | --- |");
      for (const r of agg.reducers) {
        lines.push(
          `| ${escapeTableCell(r.commandName)} | ${escapeTableCell(r.targetField)} | ${escapeTableCell(r.operation)} | ${escapeTableCell(r.sourceParameter)} |`
        );
      }
    } else {
      lines.push(`- No asynchronous corrective policies required; state is strictly verified at command boundary.`);
    }
    lines.push("");

    // --- Box 6: Handled Commands ---
    lines.push("## 6. Handled Commands");
    lines.push("| Command | Actor | Parameters | Required State | Target State | Creation | Emits Event |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const cmd of agg.commands ?? []) {
      const isCreation = cmd.isCreation ? "Yes" : "No";
      const cmdName = cmd.name || "CommandNode";
      const cmdActor = cmd.actor || "User";
      const params = (cmd.parameters || [])
        .map((p) => `${p.name || "param"}: ${p.type || "string"}${p.required ? "" : "?"}${p.isList ? "[]" : ""}`)
        .join(", ") || "-";
      const emits = (cmd.emitsEvents && cmd.emitsEvents.length > 0)
        ? cmd.emitsEvents.join(", ")
        : (cmd.emits || `${cmdName}Emitted`);

      lines.push(
        `| ${escapeTableCell(cmdName)} | ${escapeTableCell(cmdActor)} | ${escapeTableCell(params)} | ${escapeTableCell(cmd.requiredState || "-")} | ${escapeTableCell(cmd.targetState || "-")} | ${isCreation} | ${escapeTableCell(emits)} |`
      );
    }
    lines.push("");

    // --- Box 7: Created Events ---
    lines.push("## 7. Created Events");
    lines.push("| Event | Triggering Command | Emitted Data |");
    lines.push("| --- | --- | --- |");
    for (const cmd of agg.commands ?? []) {
      const cmdName = cmd.name || "CommandNode";
      const eventName = cmd.emits || `${cmdName}Emitted`;
      const eventData = (cmd.parameters || []).map((p) => p.name).join(", ") || `${agg.rootEntity || "AggregateNode"} ID`;
      lines.push(
        `| ${escapeTableCell(eventName)} | ${escapeTableCell(cmdName)} | ${escapeTableCell(eventData)} |`
      );
    }
    lines.push("");

    // --- Box 8: Throughput ---
    lines.push("## 8. Throughput");
    lines.push("- **CommandNode Handling Rate:** Medium (~10-100 commands / minute)");
    lines.push("- **Total Number of Clients:** Multiple concurrent clients");
    lines.push("- **Concurrency Conflict Chance:** Low (Scoped by AggregateNode Root ID)");
    lines.push("");

    // --- Box 9: Size ---
    lines.push("## 9. Size");
    lines.push("- **Event Growth Rate:** Low-Medium (Appends on command execution)");
    lines.push("- **Lifetime of a Single Instance:** Long-lived aggregate stream");
    lines.push("- **Number of Events Persisted:** < 1000 events per aggregate instance");
    lines.push("");
  }

  return lines.join("\n");
}
