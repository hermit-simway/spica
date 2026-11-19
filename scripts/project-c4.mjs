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
  if (!loaded.projectSystemContextDiagram) {
    console.error("ℹ️  Stale build detected (missing projectSystemContextDiagram). Rebuilding @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
    loaded = await load(true);
  }
  return loaded;
}

let projectSystemContextDiagram;
try {
  const core = await loadCore();
  projectSystemContextDiagram = core.projectSystemContextDiagram;
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
      console.log(`Usage: node scripts/project-c4.mjs [input-file] [-o output-path]`);
      console.log(`   or: pnpm project-c4 [input-file] [-o output-path]`);
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
  <title>${escapeHtml(title)} - C4 System Context Diagram</title>
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
        <span class="badge">C4 Model Level 1 • System Context</span>
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
      downloadLink.download = "${toSafeFileName(title)}-c4.svg";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  </script>
</body>
</html>
`;
}

function extractJsonFromContent(content) {
  const trimmed = content.trim();

  // 1. If it directly parses as JSON, return it
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      // Fall through to markdown block extraction
    }
  }

  // 2. Extract from Markdown ```json ... ``` or ``` ... ``` code fence
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

  // 4. Default parse attempt (will throw standard syntax error if invalid)
  return JSON.parse(trimmed);
}

function processContent(rawContent, sourceName, customOutput) {
  try {
    const model = extractJsonFromContent(rawContent);
    const diagram = projectSystemContextDiagram(model);

    // Print raw diagram to stdout for piping
    console.log(diagram);

    const title = model.systemName || (model.domain ? `${model.domain} System` : "System Context");
    const description = model.systemDescription || `Core domain architecture for ${model.domain || "system"}`;
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
        htmlPath = path.join(resolvedCustom, `${baseName}-c4-${timestamp}.html`);
        mmdPath = path.join(resolvedCustom, `${baseName}-c4-${timestamp}.mmd`);
      }
    } else {
      const outputDir = path.resolve(rootDir, "output");
      fs.mkdirSync(outputDir, { recursive: true });
      htmlPath = path.join(outputDir, `${baseName}-c4-${timestamp}.html`);
      mmdPath = path.join(outputDir, `${baseName}-c4-${timestamp}.mmd`);
    }

    // Write raw Mermaid .mmd
    fs.writeFileSync(mmdPath, diagram, "utf-8");

    // Write self-rendering HTML with interactive visual diagram and SVG export
    const htmlContent = generateHtmlPreview(title, description, diagram);
    fs.writeFileSync(htmlPath, htmlContent, "utf-8");

    console.error(`\n🎨 Visual Diagram: ${path.relative(process.cwd(), htmlPath)}`);
    console.error(`📄 Raw Mermaid:   ${path.relative(process.cwd(), mmdPath)}`);
  } catch (err) {
    console.error("❌ Failed to parse ADM JSON or project diagram:", err.message);
    process.exit(1);
  }
}

if (!inputArg || inputArg === "-") {
  // Read from stdin
  if (process.stdin.isTTY) {
    console.error("Usage: pnpm project-c4 <path-to-adm.json> [-o output-path] (or pipe JSON via stdin)");
    process.exit(1);
  }
  let raw = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => { raw += chunk; });
  process.stdin.on("end", () => {
    if (!raw.trim()) {
      console.error("Usage: pnpm project-c4 <path-to-adm.json> [-o output-path] (or pipe JSON via stdin)");
      process.exit(1);
    }
    processContent(raw, null, outputArg);
  });
} else {
  const filePath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsedBase = path.basename(filePath).replace(/\.adm\.json$|\.json$/i, "");
  processContent(raw, parsedBase, outputArg);
}
