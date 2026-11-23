import { AstRoot, AstRootSchema, AggregateNode, EntityNode, FieldNode, CommandNode, PolicyNode, ReducerDescriptor, TransitionNode, ValueObjectNode, ActorNode, ExternalSystemNode } from "./schema.js";

export class DddCrewParseError extends Error {
  readonly code = "E_DDD_CREW_PARSE_ERROR";
  readonly line?: number;

  constructor(message: string, line?: number) {
    super(`[E_DDD_CREW_PARSE_ERROR] ${line !== undefined ? `Line ${line}: ` : ""}${message}`);
    this.name = "DddCrewParseError";
    this.line = line;
  }
}

/**
 * Parses canonical DDD Crew Aggregate Design Canvas Markdown (v1.1) into a strictly validated AstRoot ADM AST.
 */
export function parseDddCrewMarkdown(markdown: string): AstRoot {
  if (!markdown || !markdown.trim()) {
    throw new DddCrewParseError("Markdown input cannot be empty", 1);
  }

  const rawLines = markdown.split(/\r?\n/);

  // Extract top-level domain metadata
  let domain = "";
  let systemName: string | undefined;
  let systemDescription: string | undefined;
  let createdAt: string | undefined;
  let specVersion: string | undefined;
  let author: string | undefined;

  const actors: ActorNode[] = [];
  const externalSystems: ExternalSystemNode[] = [];
  const aggregates: AggregateNode[] = [];

  // Split markdown into header lines and aggregate blocks
  let currentAggregateBlock: { name: string; lines: { line: string; lineNum: number }[] } | null = null;
  const aggregateBlocks: { name: string; lines: { line: string; lineNum: number }[] }[] = [];
  const headerLines: { line: string; lineNum: number }[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const line = rawLines[i];
    const trimmed = line.trim();

    const aggMatch = trimmed.match(/^#+\s*AggregateNode:\s*(.+)$/i);
    if (aggMatch) {
      if (currentAggregateBlock) {
        aggregateBlocks.push(currentAggregateBlock);
      }
      currentAggregateBlock = {
        name: aggMatch[1].trim(),
        lines: []
      };
      continue;
    }

    if (currentAggregateBlock) {
      currentAggregateBlock.lines.push({ line, lineNum });
    } else {
      headerLines.push({ line, lineNum });
    }
  }

  if (currentAggregateBlock) {
    aggregateBlocks.push(currentAggregateBlock);
  }

  // Parse Header / Top Metadata
  for (const { line } of headerLines) {
    const trimmed = line.trim();

    const titleMatch = trimmed.match(/^#+\s*(?:Aggregate Design Canvas|Application Domain Model):\s*(.+)$/i);
    if (titleMatch && !domain) {
      domain = titleMatch[1].trim();
      continue;
    }

    const domainBullet = trimmed.match(/^-\s*\*\*Domain:\*\*\s*(.+)$/i);
    if (domainBullet) {
      domain = domainBullet[1].trim();
      continue;
    }

    const sysNameBullet = trimmed.match(/^-\s*\*\*System Name:\*\*\s*(.+)$/i);
    if (sysNameBullet) {
      systemName = sysNameBullet[1].trim();
      continue;
    }

    const sysDescBullet = trimmed.match(/^-\s*\*\*System Description:\*\*\s*(.+)$/i);
    if (sysDescBullet) {
      systemDescription = sysDescBullet[1].trim();
      continue;
    }

    const createdBullet = trimmed.match(/^-\s*\*\*Created At:\*\*\s*(.+)$/i);
    if (createdBullet) {
      createdAt = createdBullet[1].trim();
      continue;
    }

    const specVersionBullet = trimmed.match(/^-\s*\*\*Spec Version:\*\*\s*(.+)$/i);
    if (specVersionBullet) {
      specVersion = specVersionBullet[1].trim();
      continue;
    }

    const authorBullet = trimmed.match(/^-\s*\*\*Author:\*\*\s*(.+)$/i);
    if (authorBullet) {
      author = authorBullet[1].trim();
      continue;
    }
  }

  // Fallback defaults for metadata if omitted in simplified DDD Crew markdown
  if (!domain) {
    if (aggregateBlocks.length > 0) {
      domain = `${aggregateBlocks[0].name}Domain`;
    } else {
      throw new DddCrewParseError("Missing Domain identifier in markdown header", 1);
    }
  }
  if (!createdAt) {
    createdAt = new Date().toISOString();
  }
  if (!specVersion) {
    specVersion = "0.0.0";
  }

  // Parse System Actors & External Systems from headerLines
  const headerTables = extractMarkdownTables(headerLines);
  for (const table of headerTables) {
    if (table.headers.includes("actor") && table.headers.includes("description")) {
      for (const row of table.rows) {
        const actorName = row["actor"] || "";
        if (actorName) {
          actors.push({
            name: actorName,
            description: row["description"] || undefined
          });
        }
      }
    } else if (table.headers.includes("system") && table.headers.includes("relationship")) {
      for (const row of table.rows) {
        const extName = row["system"] || "";
        if (extName) {
          externalSystems.push({
            name: extName,
            description: row["description"] || undefined,
            relationship: row["relationship"] || undefined,
            technology: row["technology"] || undefined
          });
        }
      }
    }
  }

  // Parse Aggregates
  if (aggregateBlocks.length === 0) {
    throw new DddCrewParseError("Markdown does not contain any '# AggregateNode: <Name>' definitions", 1);
  }

  for (const block of aggregateBlocks) {
    let rootEntity = block.name;
    const states: string[] = [];

    // Look for root entity and states bullets
    for (const { line } of block.lines) {
      const trimmed = line.trim();
      const rootMatch = trimmed.match(/^-\s*\*\*Root EntityNode:\*\*\s*(.+)$/i);
      if (rootMatch) {
        rootEntity = rootMatch[1].trim();
      }
      const statesMatch = trimmed.match(/^-\s*\*\*Lifecycle States:\*\*\s*(.+)$/i);
      if (statesMatch) {
        const parsedStates = statesMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        states.push(...parsedStates);
      }
    }

    const tables = extractMarkdownTables(block.lines);
    const entitiesMap = new Map<string, FieldNode[]>();
    const valueObjectsMap = new Map<string, FieldNode[]>();
    const commands: CommandNode[] = [];
    const reducers: ReducerDescriptor[] = [];
    const transitions: TransitionNode[] = [];
    const invariantsList: PolicyNode[] = [];
    const policiesList: PolicyNode[] = [];

    for (const table of tables) {
      // 1. Entities & Fields (Box 1)
      if (table.headers.includes("entity") && table.headers.includes("field")) {
        for (const row of table.rows) {
          const entName = row["entity"];
          const fieldName = row["field"];
          const fieldType = row["type"] || "string";
          const reqStr = (row["required"] || "yes").toLowerCase();
          const listStr = (row["islist"] || "no").toLowerCase();
          const desc = row["description"] || undefined;

          if (!entName || !fieldName) continue;

          if (!entitiesMap.has(entName)) {
            entitiesMap.set(entName, []);
          }
          entitiesMap.get(entName)!.push({
            name: fieldName,
            type: fieldType,
            required: reqStr === "yes" || reqStr === "true",
            isList: listStr === "yes" || listStr === "true",
            description: desc || undefined
          });
        }
      }

      // 2. Value Objects (Box 1)
      else if (table.headers.includes("valueobject") && table.headers.includes("field")) {
        for (const row of table.rows) {
          const voName = row["valueobject"];
          const fieldName = row["field"];
          const fieldType = row["type"] || "string";
          const reqStr = (row["required"] || "yes").toLowerCase();
          const listStr = (row["islist"] || "no").toLowerCase();

          if (!voName || !fieldName) continue;

          if (!valueObjectsMap.has(voName)) {
            valueObjectsMap.set(voName, []);
          }
          valueObjectsMap.get(voName)!.push({
            name: fieldName,
            type: fieldType,
            required: reqStr === "yes" || reqStr === "true",
            isList: listStr === "yes" || listStr === "true"
          });
        }
      }

      // 3. State Transitions Table (Box 3)
      else if (table.headers.includes("trigger") && table.headers.includes("from state") && table.headers.includes("to state")) {
        for (const row of table.rows) {
          const trigger = row["trigger"];
          const fromState = row["from state"];
          const toState = row["to state"];
          const guard = row["guard condition"] || row["guard"] || "-";

          if (trigger && fromState && toState) {
            transitions.push({
              trigger,
              fromState,
              toState,
              guardCondition: guard === "-" ? undefined : guard
            });
          }
        }
      }

      // 4. Enforced Invariants (Box 4)
      else if (
        (table.headers.includes("invariant / policy") || table.headers.includes("invariant") || table.headers.includes("policy")) &&
        table.headers.includes("description")
      ) {
        for (const row of table.rows) {
          const name = row["invariant / policy"] || row["invariant"] || row["policy"];
          const desc = row["description"] || "";
          const trace = row["intent trace"] || "-";
          if (name) {
            invariantsList.push({
              name,
              description: desc,
              intentTrace: trace === "-" ? undefined : trace
            });
          }
        }
      }

      // 5. Reducers / Corrective Policies (Box 5)
      else if (table.headers.includes("command") && table.headers.includes("target field") && table.headers.includes("operation")) {
        for (const row of table.rows) {
          const cmd = row["command"];
          const targetField = row["target field"];
          const op = (row["operation"] || "SET").toUpperCase() as "SET" | "ADD" | "SUBTRACT";
          const sourceParam = row["source parameter"] || "";

          if (cmd && targetField && sourceParam) {
            reducers.push({
              commandName: cmd,
              targetField,
              operation: op,
              sourceParameter: sourceParam
            });
          }
        }
      }

      // 6. Handled Commands (Box 6)
      else if (table.headers.includes("command") && table.headers.includes("actor")) {
        for (const row of table.rows) {
          const rawCmd = row["command"];
          if (!rawCmd) continue;

          const isCreationBadge = /\[Creation\]/i.test(rawCmd);
          const creationCol = (row["creation"] || "").toLowerCase();
          const isCreation = isCreationBadge || creationCol === "yes" || creationCol === "true";
          const cmdName = rawCmd.replace(/\[Creation\]/i, "").trim();
          const actor = row["actor"] || "User";

          const paramsStr = row["parameters"] || "-";
          const parameters: FieldNode[] = parseParameters(paramsStr);

          const reqStateRaw = row["required state"] || "-";
          const requiredState = reqStateRaw === "-" ? "" : reqStateRaw;

          const targetStateRaw = row["target state"] || "-";
          const targetState = targetStateRaw === "-" ? "" : targetStateRaw;

          const emitsRaw = row["emits event"] || row["emits"] || "-";
          const emitsEvents = emitsRaw === "-" ? undefined : emitsRaw.split(",").map((s) => s.trim()).filter(Boolean);

          const triggerRaw = row["trigger event"] || row["trigger"] || "-";
          const triggerEvent = triggerRaw === "-" ? undefined : triggerRaw;

          const policiesRaw = row["policies / invariants"] || row["invariants"] || "-";
          const policyObjs = parsePolicies(policiesRaw);
          policiesList.push(...policyObjs);
          const policies = policyObjs.map((p) => p.name);

          commands.push({
            name: cmdName,
            actor,
            isCreation: isCreation || undefined,
            requiredState,
            targetState,
            parameters,
            emitsEvents: emitsEvents && emitsEvents.length > 0 ? emitsEvents : undefined,
            triggerEvent,
            policies
          });
        }
      }
    }

    // Also extract Mermaid stateDiagram-v2 transitions if explicit transition table was not present
    if (transitions.length === 0) {
      let inMermaid = false;
      for (const { line } of block.lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("```mermaid")) {
          inMermaid = true;
          continue;
        }
        if (inMermaid && trimmed.startsWith("```")) {
          inMermaid = false;
          continue;
        }
        if (inMermaid) {
          const transMatch = trimmed.match(/([A-Za-z0-9_\[\*\]]+)\s*-->\s*([A-Za-z0-9_]+)\s*:\s*(.+)$/);
          if (transMatch) {
            const fromState = transMatch[1].trim();
            const toState = transMatch[2].trim();
            const trigger = transMatch[3].trim();
            if (fromState === "[*]") {
              const matchedCmd = commands.find((c) => c.name === trigger);
              if (matchedCmd) {
                matchedCmd.isCreation = true;
                matchedCmd.targetState = toState;
              }
            } else {
              transitions.push({
                trigger,
                fromState,
                toState
              });
              if (!states.includes(fromState)) {
                states.push(fromState);
              }
              if (!states.includes(toState)) {
                states.push(toState);
              }
            }
          }
        }
      }
    }

    // Assemble entities
    const entities: EntityNode[] = [];
    if (entitiesMap.size > 0) {
      for (const [name, fields] of entitiesMap.entries()) {
        entities.push({
          name,
          fields,
          relationships: []
        });
      }
    } else {
      entities.push({
        name: rootEntity,
        fields: [{ name: "$id", type: "string", required: true, isList: false }],
        relationships: []
      });
    }

    // Assemble value objects
    const valueObjects: ValueObjectNode[] = [];
    for (const [name, fields] of valueObjectsMap.entries()) {
      valueObjects.push({ name, type: "object", fields });
    }

    // Fallback states if omitted in bullets
    if (states.length === 0) {
      states.push("Active");
    }

    aggregates.push({
      name: block.name,
      rootEntity,
      states: states,
      entities,
      valueObjects,
      commands,
      reducers,
      ...(policiesList.length > 0 ? { policies: policiesList } : {}),
      ...(transitions.length > 0 ? { transitions: transitions } : {})
    });
  }

  const rawModel = {
    domain,
    systemName,
    systemDescription,
    specVersion,
    author,
    createdAt,
    actors: actors.length > 0 ? actors : undefined,
    externalSystems: externalSystems.length > 0 ? externalSystems : undefined,
    aggregates
  };

  try {
    return AstRootSchema.parse(rawModel);
  } catch (err: any) {
    throw new DddCrewParseError(`Schema validation failed on parsed model: ${err.message}`);
  }
}

interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

function extractMarkdownTables(lines: { line: string; lineNum: number }[]): ParsedTable[] {
  const tables: ParsedTable[] = [];
  let currentHeader: string[] | null = null;
  let currentRows: Record<string, string>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].line.trim();

    if (raw.startsWith("|") && raw.endsWith("|")) {
      const cells = splitTableRow(raw);

      if (!currentHeader) {
        if (i + 1 < lines.length && isTableSeparator(lines[i + 1].line.trim())) {
          currentHeader = cells.map((c) => c.toLowerCase());
          i++; // Skip separator line
          currentRows = [];
        }
      } else {
        const rowData: Record<string, string> = {};
        for (let j = 0; j < currentHeader.length; j++) {
          rowData[currentHeader[j]] = cells[j] || "";
        }
        currentRows.push(rowData);
      }
    } else {
      if (currentHeader && currentRows.length > 0) {
        tables.push({ headers: currentHeader, rows: currentRows });
      }
      currentHeader = null;
      currentRows = [];
    }
  }

  if (currentHeader && currentRows.length > 0) {
    tables.push({ headers: currentHeader, rows: currentRows });
  }

  return tables;
}

function splitTableRow(row: string): string[] {
  const inner = row.slice(1, -1);
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (escaped) {
      current += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(row: string): boolean {
  if (!row.startsWith("|") || !row.endsWith("|")) return false;
  const inner = row.slice(1, -1);
  return /^[\s|:-]+$/.test(inner);
}

function parseParameters(paramStr: string): FieldNode[] {
  if (!paramStr || paramStr.trim() === "-") return [];

  const items = paramStr.split(",").map((s) => s.trim()).filter(Boolean);
  const fields: FieldNode[] = [];

  for (const item of items) {
    const parts = item.split(":").map((s) => s.trim());
    if (parts.length >= 2) {
      let name = parts[0];
      let rawType = parts[1];
      let required = true;
      let isList = false;

      if (name.endsWith("?")) {
        name = name.slice(0, -1).trim();
        required = false;
      }

      if (rawType.endsWith("[]")) {
        rawType = rawType.slice(0, -2).trim();
        isList = true;
      }

      fields.push({
        name,
        type: rawType || "string",
        required,
        isList
      });
    }
  }

  return fields;
}

function parsePolicies(policyStr: string): PolicyNode[] {
  if (!policyStr || policyStr.trim() === "-") return [];

  const items = policyStr.split(";").map((s) => s.trim()).filter(Boolean);
  const policies: PolicyNode[] = [];

  for (const item of items) {
    const parts = item.split(":").map((s) => s.trim());
    if (parts.length >= 2) {
      policies.push({
        name: parts[0],
        description: parts.slice(1).join(":").trim()
      });
    } else if (parts.length === 1 && parts[0]) {
      policies.push({
        name: parts[0],
        description: parts[0]
      });
    }
  }

  return policies;
}
