import type { AstRoot, AggregateNode } from "./schema.js";
import { DEFAULT_EXCALIDRAW_TEMPLATE } from "./defaultTemplate.js";

export interface ExcalidrawElement {
  id: string;
  type: "rectangle" | "text" | "arrow" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: unknown[] | null;
  updated: number;
  link: null;
  locked: boolean;
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  baseline?: number;
  containerId?: null;
  lineHeight?: number;
}

export interface ExcalidrawDocument {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    gridSize: null;
    viewBackgroundColor: string;
  };
}

export interface ExcalidrawProjectorOptions {
  templateDoc?: ExcalidrawDocument;
}

export function loadExcalidrawTemplate(customDoc?: ExcalidrawDocument): ExcalidrawDocument {
  if (customDoc) {
    return JSON.parse(JSON.stringify(customDoc)) as ExcalidrawDocument;
  }
  return JSON.parse(JSON.stringify(DEFAULT_EXCALIDRAW_TEMPLATE)) as ExcalidrawDocument;
}

let seedCounter = 200000;
function nextSeed(): number {
  return (seedCounter = (seedCounter * 9301 + 49297) % 233280);
}

function createElementId(prefix = "el"): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

function makeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    stroke?: string;
    bg?: string;
    strokeWidth?: number;
    locked?: boolean;
    rounded?: boolean;
  } = {}
): ExcalidrawElement {
  return {
    id: createElementId("rect"),
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke || "#1e1e1e",
    backgroundColor: opts.bg || "transparent",
    fillStyle: "solid",
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: opts.rounded !== false ? { type: 3 } : null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: [],
    updated: 1703350540717,
    link: null,
    locked: opts.locked ?? false
  };
}

function makeText(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: {
    stroke?: string;
    fontSize?: number;
    align?: "left" | "center" | "right";
    locked?: boolean;
  } = {}
): ExcalidrawElement {
  const fs = opts.fontSize || 32;
  return {
    id: createElementId("text"),
    type: "text",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.stroke || "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: [],
    updated: 1703350540717,
    link: null,
    locked: opts.locked ?? false,
    text,
    originalText: text,
    fontSize: fs,
    fontFamily: 2,
    textAlign: opts.align || "left",
    verticalAlign: "top",
    baseline: Math.round(fs * 0.9),
    containerId: null,
    lineHeight: 1.15
  };
}

function makeStickyNote(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  bg: string,
  stroke = "#1e1e1e"
): ExcalidrawElement[] {
  const rect = makeRect(x, y, w, h, { bg, stroke, strokeWidth: 1.5 });
  const txt = makeText(x + 16, y + 16, w - 32, h - 32, text, {
    fontSize: 26,
    stroke: "#212529"
  });
  return [rect, txt];
}

export function projectAggregateToExcalidraw(
  agg: AggregateNode,
  baseTemplateElements: ExcalidrawElement[],
  offsetX = 0
): ExcalidrawElement[] {
  // Deep-clone base template elements directly from the referenced template
  const clonedBase: ExcalidrawElement[] = JSON.parse(
    JSON.stringify(baseTemplateElements)
  );

  // Shift base template geometry and update aggregate title
  for (const el of clonedBase) {
    el.id = createElementId("tpl");
    el.x += offsetX;
    if (el.type === "text" && el.text === "Aggregate Design Canvas") {
      el.text = `Aggregate Design Canvas: ${agg.name}`;
      el.originalText = el.text;
    }
  }

  const dynamicContent: ExcalidrawElement[] = [];

  // Box 1: Name Content
  dynamicContent.push(
    makeText(
      offsetX - 1550,
      -394,
      720,
      60,
      `${agg.name} (Root: ${agg.rootEntity || agg.name})`,
      { stroke: "#2b8a3e", fontSize: 44 }
    )
  );

  // Box 2: Description Sticky Note
  const entitiesDesc = (agg.entities || [])
    .map(
      (e) =>
        `• ${e.name} [${e.fields ? e.fields.map((f) => f.name).join(", ") : ""}]`
    )
    .join("\n");
  const fullDesc = `Root EntityNode: ${agg.rootEntity || agg.name}\n\nInternal Entities:\n${entitiesDesc || "• (Single AggregateNode Root)"}`;
  dynamicContent.push(
    ...makeStickyNote(offsetX - 1804, -130, 980, 600, fullDesc, "#fff9db")
  );

  // Box 3: State Transitions
  const states = agg.states || [];
  if (states.length > 0) {
    let currX = offsetX - 650;
    const startY = -280;
    states.forEach((st, idx) => {
      dynamicContent.push(
        ...makeStickyNote(
          currX,
          startY,
          260,
          140,
          `State:\n${st}`,
          "#e3fafc",
          "#1098ad"
        )
      );
      if (idx < states.length - 1) {
        dynamicContent.push(
          makeText(currX + 270, startY + 40, 50, 40, "➔", {
            fontSize: 48,
            stroke: "#495057"
          })
        );
      }
      currX += 340;
    });
  } else {
    dynamicContent.push(
      ...makeStickyNote(
        offsetX - 650,
        -280,
        500,
        140,
        "Lifespan: Ephemeral / Event-Driven (No explicit discrete states)",
        "#e3fafc"
      )
    );
  }

  // Box 4: Enforced Invariants
  const allPolicies = agg.policies || [];
  if (allPolicies.length > 0) {
    let invY = 660;
    allPolicies.slice(0, 4).forEach((p) => {
      dynamicContent.push(
        ...makeStickyNote(
          offsetX - 1804,
          invY,
          980,
          120,
          `[Guard] ${p.name || "InvariantNode"}\nRule: ${p.description || "Consistent aggregate state"}`,
          "#f3d9fa",
          "#ae3ec9"
        )
      );
      invY += 135;
    });
  } else {
    dynamicContent.push(
      ...makeStickyNote(
        offsetX - 1804,
        660,
        980,
        120,
        `Enforces consistency for ${agg.rootEntity || "AggregateNode"} lifecycle and identity invariants.`,
        "#f3d9fa"
      )
    );
  }

  // Box 5: Corrective Policies
  const reducers = agg.reducers || [];
  if (reducers.length > 0) {
    let polY = 1450;
    reducers.slice(0, 4).forEach((r) => {
      dynamicContent.push(
        ...makeStickyNote(
          offsetX - 1804,
          polY,
          980,
          120,
          `Cmd: [${r.commandName}] ➔ ${r.operation} ${r.targetField}\nSource: ${r.sourceParameter}`,
          "#dbe4ff",
          "#4263eb"
        )
      );
      polY += 135;
    });
  } else {
    dynamicContent.push(
      ...makeStickyNote(
        offsetX - 1804,
        1450,
        980,
        120,
        "No asynchronous corrective policies required; state verified at command boundary.",
        "#dbe4ff"
      )
    );
  }

  // Box 6: Handled Commands
  const commands = agg.commands || [];
  if (commands.length > 0) {
    let cmdY = 660;
    commands.slice(0, 4).forEach((cmd) => {
      const actor = typeof cmd.actor === "string" ? cmd.actor : "User";
      const emits = (cmd.emitsEvents && cmd.emitsEvents.length > 0) ? cmd.emitsEvents.join(", ") : `${cmd.name}Emitted`;
      dynamicContent.push(
        ...makeStickyNote(
          offsetX - 674,
          cmdY,
          980,
          120,
          `[ActorNode: ${actor}] ${cmd.name}\nEmits: ${emits}`,
          "#d0ebff",
          "#1c7ed6"
        )
      );
      cmdY += 135;
    });
  } else {
    dynamicContent.push(
      ...makeStickyNote(
        offsetX - 674,
        660,
        980,
        120,
        "No handled commands defined.",
        "#d0ebff"
      )
    );
  }

  // Box 7: Created Events
  if (commands.length > 0) {
    let evtY = 1450;
    commands.slice(0, 4).forEach((cmd) => {
      const eventName = (cmd.emitsEvents && cmd.emitsEvents.length > 0) ? cmd.emitsEvents.join(", ") : `${cmd.name}Emitted`;
      const eventData =
        (cmd.parameters || []).map((p) => p.name).join(", ") ||
        `${agg.rootEntity || "AggregateNode"} ID`;
      dynamicContent.push(
        ...makeStickyNote(
          offsetX - 674,
          evtY,
          980,
          120,
          `Event: ${eventName}\nTrigger: ${cmd.name} | Data: { ${eventData} }`,
          "#ffe8cc",
          "#f76707"
        )
      );
      evtY += 135;
    });
  } else {
    dynamicContent.push(
      ...makeStickyNote(
        offsetX - 674,
        1450,
        980,
        120,
        "No domain events defined.",
        "#ffe8cc"
      )
    );
  }

  // Box 8: Throughput Values (Placed directly into template average/max boxes)
  const throughputMetrics = [
    { boxY: 700, avg: "10/s", max: "100/s" },
    { boxY: 900, avg: "1k", max: "10k" },
    { boxY: 1100, avg: "Low", max: "Med" }
  ];
  throughputMetrics.forEach((t) => {
    dynamicContent.push(
      makeText(offsetX + 1055, t.boxY + 60, 170, 60, t.avg, {
        fontSize: 40,
        align: "center"
      }),
      makeText(offsetX + 1275, t.boxY + 60, 170, 60, t.max, {
        fontSize: 40,
        align: "center"
      })
    );
  });

  // Box 9: Size Values (Placed directly into template average/max boxes)
  const sizeMetrics = [
    { boxY: 1480, avg: "5/d", max: "50/d" },
    { boxY: 1680, avg: "Months", max: "Years" },
    { boxY: 1880, avg: "100", max: "10k" }
  ];
  sizeMetrics.forEach((s) => {
    dynamicContent.push(
      makeText(offsetX + 1055, s.boxY + 60, 170, 60, s.avg, {
        fontSize: 36,
        align: "center"
      }),
      makeText(offsetX + 1275, s.boxY + 60, 170, 60, s.max, {
        fontSize: 36,
        align: "center"
      })
    );
  });

  return [...clonedBase, ...dynamicContent];
}

export function projectDddCrewExcalidraw(
  model: AstRoot,
  options?: ExcalidrawProjectorOptions
): ExcalidrawDocument {
  const templateDoc = loadExcalidrawTemplate(options?.templateDoc);

  const elements: ExcalidrawElement[] = [];
  const aggregates = model.aggregates || [];

  aggregates.forEach((agg, idx) => {
    const offsetX = idx * 3600;
    const aggElements = projectAggregateToExcalidraw(
      agg,
      templateDoc.elements,
      offsetX
    );
    elements.push(...aggElements);
  });

  return {
    type: "excalidraw",
    version: 2,
    source: templateDoc.source || "https://excalidraw-jetbrains-plugin",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: templateDoc.appState?.viewBackgroundColor || "#ffffff"
    }
  };
}
