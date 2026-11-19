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
  if (!loaded.projectOpenApi3Spec) {
    console.error("ℹ️  Stale build detected (missing OpenAPI export). Rebuilding @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
    loaded = await load(true);
  }
  return loaded;
}

let projectOpenApi3Spec;
try {
  const core = await loadCore();
  projectOpenApi3Spec = core.projectOpenApi3Spec;
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
      console.log(`Usage: node scripts/project-openapi.mjs [input-file] [-o output-path]`);
      console.log(`   or: pnpm project-openapi [input-file] [-o output-path]`);
      console.log(`\nOptions:`);
      console.log(`  -i, --input <file>    Path to ADM JSON or Markdown file (or pass as first argument)`);
      console.log(`  -o, --output <path>   Custom output JSON file or directory (default: output/)`);
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

function extractJsonFromContent(rawContent) {
  const trimmed = rawContent.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch (_) {}
  }
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
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

function processContent(rawContent, sourceName, customOutput) {
  try {
    const model = extractJsonFromContent(rawContent);
    const openapi = projectOpenApi3Spec(model);
    const jsonStr = JSON.stringify(openapi, null, 2);

    console.log(jsonStr);

    let baseName = sourceName;
    const title = model.domainName || model.domain || "openapi";

    if (!baseName) {
      baseName = toSafeFileName(title);
    }

    const timestamp = getFormattedTimestamp();
    let outPath;

    if (customOutput) {
      const resolved = path.resolve(process.cwd(), customOutput);
      if (resolved.endsWith(".json")) {
        outPath = resolved;
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
      } else {
        fs.mkdirSync(resolved, { recursive: true });
        outPath = path.join(resolved, `${baseName}-openapi-${timestamp}.json`);
      }
    } else {
      const outputDir = path.resolve(rootDir, "output");
      fs.mkdirSync(outputDir, { recursive: true });
      outPath = path.join(outputDir, `${baseName}-openapi-${timestamp}.json`);
    }

    fs.writeFileSync(outPath, jsonStr, "utf8");
    console.error(`\n✅ OpenAPI 3.0.3 specification saved to: ${path.relative(process.cwd(), outPath)}`);
  } catch (err) {
    console.error("❌ Failed to process input:", err.message);
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
  processContent(content, baseName, outputArg);
} else {
  let content = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    content += chunk;
  });
  process.stdin.on("end", () => {
    if (!content.trim()) {
      console.error("Usage: node scripts/project-openapi.mjs <path-to-adm-json-or-markdown> [-o output]");
      console.error("   or: cat model.adm.json | node scripts/project-openapi.mjs [-o output]");
      process.exit(1);
    }
    processContent(content, "", outputArg);
  });
}
