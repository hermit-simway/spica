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
  if (!loaded.projectDomainAggregateMap) {
    console.error("ℹ️  Stale build detected (missing projectDomainAggregateMap). Rebuilding @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
    loaded = await load(true);
  }
  return loaded;
}

let projectDomainAggregateMap;
try {
  const core = await loadCore();
  projectDomainAggregateMap = core.projectDomainAggregateMap;
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
      console.log(`Usage: node scripts/project-domain-map.mjs [input-file] [-o output-path]`);
      console.log(`   or: pnpm project-domain-map [input-file] [-o output-path]`);
      console.log(`\nOptions:`);
      console.log(`  -i, --input <file>    Path to ADM JSON or Markdown file (or pass as first argument)`);
      console.log(`  -o, --output <path>   Custom output HTML file or directory (default: output/)`);
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

function generateHtmlPreview(title, description, diagram) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Domain Aggregate Map (Lens 2)</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #818cf8;
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
      max-width: 1200px;
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
      background: rgba(129, 140, 248, 0.15);
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
      background: #4f46e5;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #4338ca; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      overflow-x: auto;
      display: flex;
      justify-content: center;
    }
    .mermaid {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .raw-source {
      background: #090d16;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #94a3b8;
      white-space: pre;
      overflow-x: auto;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="badge">Virgo Lens 2 — Tactical DDD</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      <div class="actions">
        <button onclick="toggleRaw()">View Raw Mermaid</button>
        <button onclick="downloadSvg()">Save SVG</button>
      </div>
    </div>
    <div class="card">
      <div class="mermaid">
${diagram}
      </div>
    </div>
    <div id="rawBox" class="raw-source">${escapeHtml(diagram)}</div>
  </div>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    function toggleRaw() {
      const el = document.getElementById('rawBox');
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }

    function downloadSvg() {
      const svg = document.querySelector('.mermaid svg');
      if (!svg) {
        alert('SVG not yet rendered.');
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${toSafeFileName(title)}-domain-map.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;
}

function extractJsonFromContent(rawContent) {
  const trimmed = rawContent.trim();

  // 1. Clean JSON directly
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {}
  }

  // 2. Markdown codeblock containing json: ```json ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      throw new Error(`Found JSON code fence in Markdown, but failed to parse: ${e.message}`);
    }
  }

  // 3. Fallback: locate outermost { ... } envelope
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

function processContent(rawContent, sourceName, customOutput) {
  try {
    const model = extractJsonFromContent(rawContent);
    const diagram = projectDomainAggregateMap(model);

    console.log(diagram);

    const title = model.domainName || model.domain || "Domain Aggregate Map";
    const description = `Topological Tactical DDD Aggregate Map for ${title}`;
    let baseName = sourceName || toSafeFileName(title);
    const timestamp = getFormattedTimestamp();

    let htmlPath;
    let mmdPath;

    if (customOutput) {
      const resolvedCustom = path.resolve(process.cwd(), customOutput);
      if (resolvedCustom.endsWith(".html")) {
        htmlPath = resolvedCustom;
        mmdPath = resolvedCustom.replace(/\.html$/i, ".mmd");
        fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
      } else if (resolvedCustom.endsWith(".mmd")) {
        mmdPath = resolvedCustom;
        htmlPath = resolvedCustom.replace(/\.mmd$/i, ".html");
        fs.mkdirSync(path.dirname(mmdPath), { recursive: true });
      } else {
        fs.mkdirSync(resolvedCustom, { recursive: true });
        htmlPath = path.join(resolvedCustom, `${baseName}-domain-map-${timestamp}.html`);
        mmdPath = path.join(resolvedCustom, `${baseName}-domain-map-${timestamp}.mmd`);
      }
    } else {
      const outputDir = path.resolve(rootDir, "output");
      fs.mkdirSync(outputDir, { recursive: true });
      htmlPath = path.join(outputDir, `${baseName}-domain-map-${timestamp}.html`);
      mmdPath = path.join(outputDir, `${baseName}-domain-map-${timestamp}.mmd`);
    }

    fs.writeFileSync(mmdPath, diagram, "utf8");
    fs.writeFileSync(htmlPath, generateHtmlPreview(title, description, diagram), "utf8");

    console.error(`\n🎨 Visual Diagram: ${path.relative(process.cwd(), htmlPath)}`);
    console.error(`📄 Raw Mermaid:   ${path.relative(process.cwd(), mmdPath)}`);
  } catch (err) {
    console.error("❌ Error projecting Domain Aggregate Map:", err.message);
    process.exit(1);
  }
}

if (inputArg) {
  const filePath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  processContent(raw, base, outputArg);
} else {
  let stdinData = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    stdinData += chunk;
  });
  process.stdin.on("end", () => {
    if (!stdinData.trim()) {
      console.error("Usage: node scripts/project-domain-map.mjs <path-to-adm.json-or-markdown> [-o output]");
      console.error("   or: cat adm.json | node scripts/project-domain-map.mjs [-o output]");
      process.exit(1);
    }
    processContent(stdinData, null, outputArg);
  });
}
