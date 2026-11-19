import { AstRoot } from "./schema.js";
import { idFieldToEntityName } from "./admValidator.js";

/**
 * Projects a validated AstRoot into a visual Mermaid Domain AggregateNode Map (graph TD).
 * Renders aggregate subgraphs, internal commands/states, entity foreign-key dependencies,
 * and cross-aggregate domain event flow edges.
 */
export function projectDomainAggregateMap(model: AstRoot): string {
  const lines: string[] = ["graph TD"];

  const foreignKeyEdges: string[] = [];
  const eventFlowEdges: string[] = [];

  const aggregateNames = new Set(model.aggregates.map((a) => a.name));

  for (const agg of model.aggregates) {
    const states = agg.states || [];
    const stateStr = states.length > 0 ? states.join(" | ") : "Unspecified";

    lines.push(`    subgraph ${agg.name} [AggregateNode: ${agg.name}]`);
    lines.push(`        ${agg.name}_States["States: ${stateStr}"]`);

    for (const cmd of agg.commands ?? []) {
      lines.push(`        ${cmd.name}["CommandNode: ${cmd.name}"] --> ${agg.name}_States`);
    }

    lines.push("    end");

    // Collect cross-aggregate references from entity fields (Foreign Keys)
    for (const ent of agg.entities ?? []) {
      for (const field of ent.fields) {
        const targetEntity = idFieldToEntityName(field.name);
        if (targetEntity && targetEntity !== agg.name && targetEntity !== agg.rootEntity) {
          const cardinality = field.isList ? "1..*" : field.required ? "1..1" : "0..1";
          foreignKeyEdges.push(
            `    ${targetEntity} -.->|"${field.name} (${cardinality})"| ${agg.name}`
          );
        }
      }
    }

    // Collect cross-aggregate domain event flow edges
    for (const cmd of agg.commands ?? []) {
      // 1. Explicit triggerEvent: e.g. "Loan.BookReturned" or "BookReturned"
      if (cmd.triggerEvent) {
        const parts = cmd.triggerEvent.split(".");
        if (parts.length === 2 && aggregateNames.has(parts[0])) {
          eventFlowEdges.push(`    ${parts[0]} ==>|"triggers on ${parts[1]}"| ${agg.name}`);
        } else {
          // If triggerEvent doesn't specify source aggregate prefix, search all aggregates for matching command/emits
          for (const otherAgg of model.aggregates) {
            if (otherAgg.name === agg.name) continue;
            const matches = (otherAgg.commands ?? []).some(
              (c) => c.emits === cmd.triggerEvent || `${c.name}Event` === cmd.triggerEvent
            );
            if (matches) {
              eventFlowEdges.push(`    ${otherAgg.name} ==>|"triggers on ${cmd.triggerEvent}"| ${agg.name}`);
            }
          }
        }
      }

      // 2. Policies declaring cross-aggregate source
      for (const policyName of cmd.policies || []) {
        const policy = (agg.policies || []).find((p) => p.name === policyName);
        if (!policy) continue;
        if (policy.sourceAggregate && aggregateNames.has(policy.sourceAggregate) && policy.sourceAggregate !== agg.name) {
          const eventLabel = policy.sourceEvent || policy.name;
          eventFlowEdges.push(`    ${policy.sourceAggregate} ==>|"triggers on ${eventLabel}"| ${agg.name}`);
        } else if (policy.intentTrace || policy.description) {
          const text = `${policy.intentTrace || ""} ${policy.description || ""}`;
          // Match patterns like: "on Loan.BookReturned" or "when Loan emits ReturnBook"
          const match = text.match(/(?:on|when|from)\s+([A-Z][a-zA-Z0-9]+)\.([A-Z][a-zA-Z0-9]+)/);
          if (match && aggregateNames.has(match[1]) && match[1] !== agg.name) {
            eventFlowEdges.push(`    ${match[1]} ==>|"triggers on ${match[2]}"| ${agg.name}`);
          }
        }
      }
    }
  }

  // Append structural foreign-key edges
  if (foreignKeyEdges.length > 0) {
    lines.push("");
    const uniqueFkEdges = Array.from(new Set(foreignKeyEdges));
    lines.push(...uniqueFkEdges);
  }

  // Append reactive event-flow edges
  if (eventFlowEdges.length > 0) {
    lines.push("");
    const uniqueEventEdges = Array.from(new Set(eventFlowEdges));
    lines.push(...uniqueEventEdges);
  }

  return lines.join("\n");
}

/**
 * Projects a validated AstRoot into a formal UML Class Diagram (Mermaid classDiagram)
 * with explicit composition (*--) and association (-->) semantics.
 */
export function projectClassDiagram(model: AstRoot): string {
  const lines: string[] = ["classDiagram"];

  for (const agg of model.aggregates) {
    for (const ent of agg.entities ?? []) {
      lines.push(`    class ${ent.name} {`);
      for (const field of ent.fields) {
        const listMarker = field.isList ? "[]" : "";
        lines.push(`        +${field.type}${listMarker} ${field.name}`);
      }
      lines.push("    }");

      // Internal aggregate composition (rootEntity owns child entities)
      if (ent.name !== agg.rootEntity) {
        lines.push(`    ${agg.rootEntity} "1" *-- "0..*" ${ent.name} : contains`);
      }

      // Foreign entity associations
      for (const field of ent.fields) {
        const targetEntity = idFieldToEntityName(field.name);
        if (targetEntity && targetEntity !== ent.name) {
          const cardinality = field.isList ? "\"0..*\"" : field.required ? "\"1\"" : "\"0..1\"";
          lines.push(`    ${ent.name} --> ${cardinality} ${targetEntity} : ${field.name}`);
        }
      }
    }

    for (const vo of agg.valueObjects || []) {
      lines.push(`    class ${vo.name} {`);
      lines.push("        <<ValueObjectNode>>");
      if (vo.fields && vo.fields.length > 0) {
        for (const field of vo.fields) {
          const listMarker = field.isList ? "[]" : "";
          lines.push(`        +${field.type}${listMarker} ${field.name}`);
        }
      } else if (vo.values && vo.values.length > 0) {
        for (const val of vo.values) {
          lines.push(`        +${val}`);
        }
      }
      lines.push("    }");
      lines.push(`    ${agg.rootEntity} ..> ${vo.name} : uses`);
    }
  }

  return lines.join("\n");
}

/**
 * Projects a validated AstRoot into a formal UML State Machine Diagram (Mermaid stateDiagram-v2)
 * for lifecycle soundness, state reachability, guard evaluation, and command triggers.
 */
export function projectStateMachineDiagram(model: AstRoot): string {
  const lines: string[] = ["stateDiagram-v2"];

  for (const agg of model.aggregates) {
    const states = agg.states || [];
    if (states.length === 0) continue;

    lines.push(`    state "${agg.name} Lifecycle" as ${agg.name}Lifecycle {`);

    // Process explicit transitions if present
    const explicitTransitions = agg.transitions ?? [];
    if (explicitTransitions.length > 0) {
      for (const tr of explicitTransitions) {
        const guard = tr.guardCondition ? ` [${tr.guardCondition}]` : "";
        const from = tr.fromState === "" || tr.fromState === "[*]" ? "[*]" : tr.fromState;
        lines.push(`        ${from} --> ${tr.toState} : ${tr.trigger}${guard}`);
      }
    } else {
      // Derive transitions deterministically from commands
      for (const cmd of agg.commands ?? []) {
        const isCreation = cmd.isCreation ?? (cmd.requiredState === "");
        const policies = cmd.policies || [];
        const guard = policies.length > 0 ? ` [${policies.join(", ")}]` : "";

        if (isCreation && cmd.targetState) {
          lines.push(`        [*] --> ${cmd.targetState} : ${cmd.name}${guard}`);
        } else if (cmd.requiredState && cmd.targetState) {
          lines.push(`        ${cmd.requiredState} --> ${cmd.targetState} : ${cmd.name}${guard}`);
        }
      }
    }

    lines.push("    }");
  }

  return lines.join("\n");
}

/**
 * Helper to produce a valid Mermaid identifier from arbitrary strings.
 */
function toMermaidId(str: string): string {
  const sanitized = str.replace(/[^a-zA-Z0-9]/g, "");
  if (!sanitized) return "systemObj";
  return sanitized.charAt(0).toLowerCase() + sanitized.slice(1);
}

/**
 * Projects a validated AstRoot into Simon Brown's C4 Model Level 1 (System Context Diagram)
 * using Mermaid's native C4Context syntax with explicit integration transport protocols.
 */
export function projectSystemContextDiagram(model: AstRoot): string {
  const lines: string[] = ["C4Context"];

  const rawDomain = model.domainName || "System";
  const systemName = model.systemName || `${rawDomain} System`;
  const systemId = toMermaidId(systemName);
  const systemDesc = model.systemDescription || `Core domain platform for ${rawDomain}`;

  lines.push(`    title System Context: ${systemName}`);

  // Resolve Human Actors (from explicit model.actors or dynamically extracted from commands)
  const actorMap = new Map<string, string>();
  for (const act of model.actors || []) {
    if (/^(system|internal|cron|scheduler|timer)$/i.test(act.name)) continue;
    actorMap.set(act.name, act.description || `User interacting with ${systemName}`);
  }

  // Extract from commands only if model.actors was not provided, ignoring internal automated processes
  if (!model.actors || model.actors.length === 0) {
    for (const agg of model.aggregates) {
      for (const cmd of agg.commands ?? []) {
        if (cmd.actor && !/^(system|internal|cron|scheduler|timer)$/i.test(cmd.actor) && !actorMap.has(cmd.actor)) {
          actorMap.set(cmd.actor, `ActorNode executing ${cmd.name} operations`);
        }
      }
    }
  }

  // If still no actors, scan aggregates for human persona names (e.g. Patron, User, Customer, Member, Admin)
  if (actorMap.size === 0) {
    for (const agg of model.aggregates) {
      if (/user|member|customer|patron|operator|admin|client|guest|buyer|seller|driver|passenger|patient|doctor|student|teacher/i.test(agg.name)) {
        actorMap.set(agg.name, `Primary human persona for ${agg.name}`);
      }
    }
  }

  // Fallback if no human personas detected
  if (actorMap.size === 0) {
    actorMap.set("User", `Primary user interacting with ${systemName}`);
  }

  // Emit Person definitions
  for (const [name, desc] of actorMap.entries()) {
    const actId = toMermaidId(name);
    lines.push(`    Person(${actId}, "${name}", "${desc}")`);
  }

  // Emit Primary System definition
  lines.push(`    System(${systemId}, "${systemName}", "${systemDesc}")`);

  // Emit External Systems
  const extSystems = model.externalSystems || [];
  for (const ext of extSystems) {
    const extId = toMermaidId(ext.name);
    const desc = ext.description || "External third-party service or bounded context";
    lines.push(`    System_Ext(${extId}, "${ext.name}", "${desc}")`);
  }

  // Relationships: Actors -> System (with standard C4 transport technology)
  for (const [name] of actorMap.entries()) {
    const actId = toMermaidId(name);
    lines.push(`    Rel(${actId}, ${systemId}, "Interacts with", "Web UI / API")`);
  }

  // Relationships: System -> External Systems (with parsed or derived technology badge)
  for (const ext of extSystems) {
    const extId = toMermaidId(ext.name);
    const rawRel = ext.relationship || "Integrates with";

    let label = rawRel;
    let tech = ext.technology || "";

    if (!tech) {
      // Check for bracketed technology hint: "Sends pickup notices [Async/Kafka]"
      const bracketMatch = rawRel.match(/^(.*?)\s*\[(.*?)\]$/);
      if (bracketMatch) {
        label = bracketMatch[1].trim();
        tech = bracketMatch[2].trim();
      } else {
        // Derive technology from relationship keywords
        const lower = rawRel.toLowerCase();
        if (/event|notify|alert|publish|async|kafka|queue|stream|webhook/i.test(lower)) {
          tech = "Async Event";
        } else if (/api|charge|pay|verify|gateway|http|rest/i.test(lower)) {
          tech = "HTTPS/REST";
        } else {
          tech = "Integration";
        }
      }
    }

    lines.push(`    Rel(${systemId}, ${extId}, "${label}", "${tech}")`);
  }

  return lines.join("\n");
}

