#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const coreDist = path.resolve(rootDir, "packages/core/dist/index.js");

async function loadCore() {
  const load = async (bust = false) => {
    const url = pathToFileURL(coreDist).href + (bust ? `?t=${Date.now()}` : "");
    return await import(url);
  };

  if (!fs.existsSync(coreDist)) {
    console.error("ℹ️  Building @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
  }

  let loaded = await load();
  if (!loaded.projectDddCrewMarkdown || !loaded.projectOpenApi3Spec || !loaded.projectSystemContextDiagram) {
    console.error("ℹ️  Stale build detected (missing lens exports). Rebuilding @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
    loaded = await load(true);
  }
  return loaded;
}

let core;
try {
  core = await loadCore();
} catch (e) {
  console.error("❌ Error loading @simway/spica at:", coreDist);
  console.error(e);
  process.exit(1);
}

function parseCliArgs(argv) {
  let input = null;
  let output = null;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
    } else if (arg === "-i" || arg === "--input") {
      input = argv[++i];
    } else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: node scripts/project-all.mjs [input-file] [-o output-dir]`);
      console.log(`   or: pnpm project-all [input-file] [-o output-dir]`);
      console.log(`\nGenerates all 5 visual, domain, and specification projection lenses simultaneously.`);
      console.log(`\nOptions:`);
      console.log(`  -i, --input <file>    Path to ADM JSON or Markdown file (or pass as first positional argument)`);
      console.log(`  -o, --output <dir>    Custom destination directory for generated artifacts (default: output/)`);
      console.log(`  -h, --help            Show this help message`);
      process.exit(0);
    } else if (!arg.startsWith("-") && !input) {
      input = arg;
    }
  }

  return { input, output };
}

const { input: inputArg, output: outputArg } = parseCliArgs(process.argv);

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${MM}${dd}-${hh}${mm}${ss}`;
}

function toSafeFileName(str) {
  if (!str) return "output";
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function generateHtmlPreview(title, description, badge, diagram) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - ${escapeHtml(badge)}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      width: 100%;
      max-width: 1100px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    h1 { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 6px; }
    p { font-size: 14px; color: var(--text-muted); }
    .actions { display: flex; gap: 10px; }
    button {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s;
    }
    button:hover { background: #0369a1; }
    .canvas-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: auto;
      min-height: 480px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .mermaid {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .source-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
    }
    details summary {
      font-size: 13px;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
    }
    details[open] summary { margin-bottom: 12px; color: var(--accent); }
    pre {
      background: #020617;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #e2e8f0;
      border: 1px solid #1e293b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">${escapeHtml(badge)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="actions">
        <button onclick="downloadSvg()">Download SVG</button>
      </div>
    </div>

    <div class="canvas-card">
      <div class="mermaid" id="diagram-container">
${diagram}
      </div>
    </div>

    <div class="source-card">
      <details>
        <summary>View Raw Mermaid Specification (.mmd)</summary>
        <pre><code>${escapeHtml(diagram)}</code></pre>
      </details>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose'
    });

    function downloadSvg() {
      const svg = document.querySelector("#diagram-container svg");
      if (!svg) {
        alert("SVG not rendered yet!");
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      downloadLink.download = "${toSafeFileName(title)}-${toSafeFileName(badge)}.svg";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  </script>
</body>
</html>`;
}

function generateDddCanvasHtml(model, markdown) {
  const title = model.domainName || model.domain || "Domain Model";
  const system = model.systemName || "System";
  const aggregatesJson = JSON.stringify(model.aggregates);
  const markdownEscaped = escapeHtml(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aggregate Design Canvas - ${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --box-bg: #0f172a;
      --cmd-bg: #0c4a6e;
      --cmd-border: #0284c7;
      --evt-bg: #7c2d12;
      --evt-border: #ea580c;
      --inv-bg: #581c87;
      --inv-border: #a855f7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 30px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .wrapper { width: 100%; max-width: 1200px; display: flex; flex-direction: column; gap: 20px; }
    header {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    h1 { font-size: 24px; font-weight: 700; color: #fff; }
    p.subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .tab-btn {
      background: #0f172a;
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn.active {
      background: var(--accent);
      color: #0f172a;
      border-color: var(--accent);
    }
    .btn {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s;
    }
    .btn:hover { background: #0369a1; }

    /* 9-Box Grid Layout matching DDD Crew Canvas v1.1 */
    .canvas-container {
      background: #182234;
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    .canvas-title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .grid-row-1 {
      display: grid;
      grid-template-columns: 350px 1fr;
      gap: 16px;
    }
    .grid-row-2 {
      display: grid;
      grid-template-columns: 350px 1fr 1fr;
      gap: 16px;
    }
    .grid-row-3 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .grid-row-4 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 900px) {
      .grid-row-1, .grid-row-2, .grid-row-3, .grid-row-4 {
        grid-template-columns: 1fr;
      }
    }
    .box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 120px;
    }
    .box-header {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-list { display: flex; flex-direction: column; gap: 8px; }
    .card {
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.4;
    }
    .card-cmd {
      background: var(--cmd-bg);
      border: 1px solid var(--cmd-border);
      color: #bae6fd;
    }
    .card-evt {
      background: var(--evt-bg);
      border: 1px solid var(--evt-border);
      color: #fed7aa;
    }
    .card-inv {
      background: var(--inv-bg);
      border: 1px solid var(--inv-border);
      color: #f3e8ff;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      background: #0f172a;
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #0f172a;
      border-radius: 6px;
      font-size: 12px;
    }
    .metric-val { font-weight: 700; color: #38bdf8; }
    .source-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
    }
    details summary {
      font-size: 13px;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
    }
    pre {
      background: #020617;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #e2e8f0;
      border: 1px solid #1e293b;
      margin-top: 10px;
    }
    .mermaid-box {
      background: #ffffff;
      border-radius: 6px;
      padding: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 160px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header>
      <div>
        <span class="badge">Lens 3 • DDD Crew Aggregate Design Canvas</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(system)}</p>
        <div class="tabs" id="tab-buttons"></div>
      </div>
      <div>
        <button class="btn" onclick="window.print()">Print / PDF</button>
      </div>
    </header>

    <div class="canvas-container" id="canvas-view">
      <!-- Injected via JavaScript based on selected aggregate tab -->
    </div>

    <div class="source-card">
      <details>
        <summary>View Canonical DDD Crew Markdown</summary>
        <pre><code>${markdownEscaped}</code></pre>
      </details>
    </div>
  </div>

  <script>
    const aggregates = ${aggregatesJson};
    let activeIndex = 0;

    function escapeHtml(str) {
      if (!str) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function renderTabs() {
      const container = document.getElementById("tab-buttons");
      container.innerHTML = aggregates.map((agg, idx) => \`
        <button class="tab-btn \${idx === activeIndex ? "active" : ""}" onclick="selectTab(\${idx})">
          Aggregate: \${escapeHtml(agg.name)}
        </button>
      \`).join("");
    }

    function selectTab(idx) {
      activeIndex = idx;
      renderTabs();
      renderCanvas();
    }

    function renderCanvas() {
      const agg = aggregates[activeIndex];
      if (!agg) return;

      const states = agg.$states || agg.states || [];
      const commands = agg.commands || [];
      const reducers = agg.reducers || [];
      const policies = commands.flatMap(c => c.policies || []);

      // Build state diagram
      let stateDiagram = "stateDiagram-v2\\n";
      for (const cmd of commands) {
        if (cmd.isCreation && cmd.targetState) {
          stateDiagram += \`    [*] --> \${cmd.targetState}: \${cmd.name}\\n\`;
        } else if (cmd.requiredState && cmd.targetState) {
          stateDiagram += \`    \${cmd.requiredState} --> \${cmd.targetState}: \${cmd.name}\\n\`;
        }
      }
      if (commands.length === 0 && states.length > 0) {
        states.forEach(s => { stateDiagram += \`    [*] --> \${s}\\n\`; });
      }

      const html = \`
        <div class="canvas-title">
          <span>Aggregate Design Canvas: \${escapeHtml(agg.name)}</span>
          <span style="font-size: 13px; font-weight: 500; color: #94a3b8;">Root Entity: \${escapeHtml(agg.rootEntity)}</span>
        </div>

        <!-- ROW 1: Name (Box 1) & State Transitions (Box 3) -->
        <div class="grid-row-1">
          <div class="box">
            <div class="box-header">1. Name</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;">\${escapeHtml(agg.name)}</div>
            <p style="font-size: 12px; color: #94a3b8;">Root Entity: <b style="color: #fff;">\${escapeHtml(agg.rootEntity)}</b></p>
            <div class="chips">
              <span class="chip">Lifespan: Long-lived</span>
              <span class="chip">\${(agg.entities || []).length} Entity</span>
            </div>
          </div>
          <div class="box">
            <div class="box-header">3. State Transitions</div>
            <div class="chips" style="margin-bottom: 6px;">
              \${states.map(s => \`<span class="chip" style="background: rgba(56,189,248,0.2); border-color: #38bdf8; color: #fff;">\${escapeHtml(s)}</span>\`).join("")}
            </div>
            <div class="mermaid-box">
              <div class="mermaid">\${stateDiagram}</div>
            </div>
          </div>
        </div>

        <!-- ROW 2: Description (Box 2), Invariants (Box 4), Corrective Policies (Box 5) -->
        <div class="grid-row-2">
          <div class="box">
            <div class="box-header">2. Description</div>
            <p style="font-size: 13px; line-height: 1.5; color: #cbd5e1;">
              Consistency boundary for \${escapeHtml(agg.name)}. Coordinates transactional consistency and lifecycle rules for \${escapeHtml(agg.rootEntity)}.
            </p>
          </div>
          <div class="box">
            <div class="box-header">4. Enforced Invariants</div>
            <div class="card-list">
              \${policies.length > 0
                ? policies.map(p => \`
                  <div class="card card-inv">
                    <b>\${escapeHtml(p.name)}</b>: \${escapeHtml(p.description)}
                  </div>
                \`).join("")
                : \`<div class="card card-inv">Enforces structural consistency on \${escapeHtml(agg.rootEntity)} identity & state transitions.</div>\`
              }
            </div>
          </div>
          <div class="box">
            <div class="box-header">5. Corrective Policies</div>
            <div class="card-list">
              \${reducers.length > 0
                ? reducers.map(r => \`
                  <div class="card" style="background: #1e1b4b; border: 1px solid #4338ca; color: #c7d2fe;">
                    <b>Reducer</b>: \${escapeHtml(r.command)} -> \${escapeHtml(r.targetField)} (\${escapeHtml(r.operation)} \${escapeHtml(r.sourceParameter)})
                  </div>
                \`).join("")
                : \`<div class="card" style="background: #1e1b4b; border: 1px solid #4338ca; color: #c7d2fe;">No asynchronous corrective policies required; invariants enforced synchronously.</div>\`
              }
            </div>
          </div>
        </div>

        <!-- ROW 3: Handled Commands (Box 6) & Created Events (Box 7) -->
        <div class="grid-row-3">
          <div class="box">
            <div class="box-header">6. Handled Commands</div>
            <div class="card-list">
              \${commands.map(c => \`
                <div class="card card-cmd">
                  <div style="display: flex; justify-content: space-between;">
                    <b>\${escapeHtml(c.name)}</b>
                    <span style="font-size: 11px; opacity: 0.8;">[\${escapeHtml(c.actor)}]</span>
                  </div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                    Params: \${(c.parameters || []).map(p => p.name + ": " + p.type).join(", ") || "None"}
                  </div>
                  <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">
                    \${c.requiredState ? escapeHtml(c.requiredState) + " &rarr; " : ""}\${c.targetState ? escapeHtml(c.targetState) : "Current"}
                  </div>
                </div>
              \`).join("")}
            </div>
          </div>
          <div class="box">
            <div class="box-header">7. Created Events</div>
            <div class="card-list">
              \${commands.map(c => {
                const evt = c.emits || (c.name + "Emitted");
                return \`
                  <div class="card card-evt">
                    <div style="display: flex; justify-content: space-between;">
                      <b>\${escapeHtml(evt)}</b>
                      <span style="font-size: 11px; opacity: 0.8;">via \${escapeHtml(c.name)}</span>
                    </div>
                    <div style="font-size: 11px; color: #fed7aa; margin-top: 4px;">
                      Payload: \${(c.parameters || []).map(p => p.name).join(", ") || agg.rootEntity + " ID"}
                    </div>
                  </div>
                \`;
              }).join("")}
            </div>
          </div>
        </div>

        <!-- ROW 4: Throughput (Box 8) & Size (Box 9) -->
        <div class="grid-row-4">
          <div class="box">
            <div class="box-header">8. Throughput</div>
            <div class="metric-row">
              <span>Command Handling Rate</span>
              <span class="metric-val">Medium (~10-100 / min)</span>
            </div>
            <div class="metric-row">
              <span>Total Number of Clients</span>
              <span class="metric-val">Multiple Concurrent</span>
            </div>
            <div class="metric-row">
              <span>Concurrency Conflict Chance</span>
              <span class="metric-val" style="color: #4ade80;">Low</span>
            </div>
          </div>
          <div class="box">
            <div class="box-header">9. Size</div>
            <div class="metric-row">
              <span>Event Growth Rate</span>
              <span class="metric-val">Low-Medium</span>
            </div>
            <div class="metric-row">
              <span>Lifetime of Single Instance</span>
              <span class="metric-val">Long-lived Stream</span>
            </div>
            <div class="metric-row">
              <span>Number of Events Persisted</span>
              <span class="metric-val">&lt; 1,000 / instance</span>
            </div>
          </div>
        </div>
      \`;

      document.getElementById("canvas-view").innerHTML = html;
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      mermaid.run({ querySelector: ".mermaid" });
    }

    renderTabs();
    renderCanvas();
  </script>
</body>
</html>`;
}

function extractJsonFromContent(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {}
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      throw new Error(`Found JSON code fence in Markdown, but failed to parse: ${e.message}`);
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  return JSON.parse(trimmed);
}

function processAll(rawContent, sourceName, customDir) {
  try {
    const model = extractJsonFromContent(rawContent);

    const title = model.systemName || (model.domain ? `${model.domain} System` : "System");
    const domainName = model.domainName || model.domain || "domain";
    let baseName = sourceName || toSafeFileName(title);
    const timestamp = getFormattedTimestamp();

    const outputDir = customDir
      ? path.resolve(process.cwd(), customDir)
      : path.resolve(rootDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`\n🚀 Projecting all 4 Lenses for "${title}" (${domainName})...\n`);

    // --- Lens 1: C4 System Context ---
    const c4Diagram = core.projectSystemContextDiagram(model);
    const c4HtmlPath = path.join(outputDir, `${baseName}-c4-${timestamp}.html`);
    const c4MmdPath = path.join(outputDir, `${baseName}-c4-${timestamp}.mmd`);
    fs.writeFileSync(c4MmdPath, c4Diagram, "utf8");
    fs.writeFileSync(
      c4HtmlPath,
      generateHtmlPreview(
        title,
        model.systemDescription || "C4 Level 1 System Context Diagram",
        "Lens 1 • C4 System Context",
        c4Diagram
      ),
      "utf8"
    );

    // --- Lens 2: Domain Aggregate Map ---
    const domainMapDiagram = core.projectDomainAggregateMap(model);
    const mapHtmlPath = path.join(outputDir, `${baseName}-domain-map-${timestamp}.html`);
    const mapMmdPath = path.join(outputDir, `${baseName}-domain-map-${timestamp}.mmd`);
    fs.writeFileSync(mapMmdPath, domainMapDiagram, "utf8");
    fs.writeFileSync(
      mapHtmlPath,
      generateHtmlPreview(
        title,
        `Topological Tactical DDD Aggregate Map for ${title}`,
        "Lens 2 • Domain Aggregate Map",
        domainMapDiagram
      ),
      "utf8"
    );

    // --- Lens 3: DDD Crew Canvas & Markdown ---
    const dddMarkdown = core.projectDddCrewMarkdown(model);
    const dddPath = path.join(outputDir, `${baseName}-ddd-canvas-${timestamp}.md`);
    const dddHtmlPath = path.join(outputDir, `${baseName}-ddd-canvas-${timestamp}.html`);
    const dddExcalidrawPath = path.join(outputDir, `${baseName}-ddd-canvas-${timestamp}.excalidraw`);
    fs.writeFileSync(dddPath, dddMarkdown, "utf8");
    fs.writeFileSync(dddHtmlPath, generateDddCanvasHtml(model, dddMarkdown), "utf8");
    if (core.projectDddCrewExcalidraw) {
      const excalidrawDoc = core.projectDddCrewExcalidraw(model);
      fs.writeFileSync(dddExcalidrawPath, JSON.stringify(excalidrawDoc, null, 2), "utf8");
    }

    // --- Lens 4: OpenAPI 3.0.3 Specification ---
    const openapiObj = core.projectOpenApi3Spec(model);
    const openapiPath = path.join(outputDir, `${baseName}-openapi-${timestamp}.json`);
    fs.writeFileSync(openapiPath, JSON.stringify(openapiObj, null, 2), "utf8");

    console.log("====================================================================");
    console.log("🎉 All 4 Projection Lenses Generated Successfully!");
    console.log("====================================================================");
    console.log(`🌐 Lens 1 (C4 Context):     ${path.relative(process.cwd(), c4HtmlPath)}`);
    console.log(`📊 Lens 2 (Domain Map):     ${path.relative(process.cwd(), mapHtmlPath)}`);
    console.log(`📋 Lens 3 (DDD Canvas):     ${path.relative(process.cwd(), dddHtmlPath)}`);
    console.log(`                           (Excalidraw:  ${path.relative(process.cwd(), dddExcalidrawPath)})`);
    console.log(`                           (Markdown:    ${path.relative(process.cwd(), dddPath)})`);
    console.log(`🔌 Lens 4 (OpenAPI 3.0.3):  ${path.relative(process.cwd(), openapiPath)}`);
    console.log("====================================================================\n");
  } catch (err) {
    console.error("❌ Failed to project lenses:", err.message);
    process.exit(1);
  }
}

if (inputArg) {
  const filePath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const baseName = toSafeFileName(path.basename(filePath, path.extname(filePath)));
  processAll(content, baseName, outputArg);
} else {
  let content = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { content += chunk; });
  process.stdin.on("end", () => {
    if (!content.trim()) {
      console.error("Usage: node scripts/project-all.mjs <input-file> [-o output-dir]");
      console.error("   or: pnpm project-all <input-file> [-o output-dir]");
      process.exit(1);
    }
    processAll(content, null, outputArg);
  });
}
