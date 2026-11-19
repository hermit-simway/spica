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
  if (!loaded.projectKiroSpec) {
    console.error("ℹ️  Rebuilding @simway/spica...");
    execSync("pnpm -r build", { cwd: rootDir, stdio: "inherit" });
    loaded = await load(true);
  }
  return loaded;
}

let projectKiroSpec;
let validateAdm;
try {
  const core = await loadCore();
  projectKiroSpec = core.projectKiroSpec;
  validateAdm = core.validateAdm;
} catch (e) {
  console.error("❌ Error loading @simway/spica at:", coreDist);
  console.error(e);
  process.exit(1);
}

function parseCliArgs(argv) {
  let input = null;
  let output = null;
  let aggregate = null;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      output = argv[++i];
    } else if (arg === "-i" || arg === "--input") {
      input = argv[++i];
    } else if (arg === "-a" || arg === "--aggregate") {
      aggregate = argv[++i];
    } else if (arg === "-h" || arg === "--help") {
      console.log(`
Spica AWS Kiro Spec Projector
Usage:
  node ./scripts/project-kiro.mjs [options]

Options:
  -i, --input <file>        Path to input ADM JSON (default: packages/core/test/fixtures/canonical-library.adm.json)
  -o, --output <dir>        Output directory for .kiro/specs/ (default: .kiro/specs)
  -a, --aggregate <name>    Project only a specific aggregate feature spec
  -h, --help                Show this help message
`);
      process.exit(0);
    } else if (!arg.startsWith("-") && !input) {
      input = arg;
    }
  }

  return { input, output, aggregate };
}

const args = parseCliArgs(process.argv);
const inputPath = args.input
  ? path.resolve(process.cwd(), args.input)
  : path.resolve(rootDir, "packages/core/test/fixtures/canonical-library.adm.json");

const baseOutputDir = args.output
  ? path.resolve(process.cwd(), args.output)
  : path.resolve(rootDir, ".kiro/specs");

if (!fs.existsSync(inputPath)) {
  console.error(`❌ Input ADM file not found: ${inputPath}`);
  process.exit(1);
}

const rawModel = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const validation = validateAdm(rawModel);
if (!validation.valid) {
  console.error("❌ ADM validation failed with errors:");
  for (const err of validation.errors) {
    console.error(`   - [${err.code}] ${err.message} (${err.path})`);
  }
  process.exit(1);
}

const result = projectKiroSpec(validation.model, {
  aggregateName: args.aggregate || undefined,
});

const featureDir = path.join(baseOutputDir, result.featureName);
fs.mkdirSync(featureDir, { recursive: true });

const filesToWrite = [
  { name: "requirements.md", content: result.files.requirements },
  { name: "design.md", content: result.files.design },
  { name: "tasks.md", content: result.files.tasks },
];

console.log(`✨ Projecting AWS Kiro Specs to: ${featureDir}`);
for (const file of filesToWrite) {
  const filePath = path.join(featureDir, file.name);
  fs.writeFileSync(filePath, file.content, "utf8");
  console.log(`   ✓ ${file.name} (${Buffer.byteLength(file.content, "utf8")} bytes)`);
}

console.log("\n🚀 Kiro spec generation complete. Ready for AWS Kiro IDE agent consumption!");
