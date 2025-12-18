import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  ".cursor",
  "terminals",
  "mcps",
  "dist",
  "build"
]);

const IGNORE_FILES = new Set(["package-lock.json"]);

const EXT_GROUPS = [
  { name: "app", exts: new Set([".ts", ".tsx", ".js", ".jsx"]), filter: (p) => p.includes(`${path.sep}app${path.sep}`) },
  { name: "components", exts: new Set([".ts", ".tsx", ".js", ".jsx"]), filter: (p) => p.includes(`${path.sep}components${path.sep}`) },
  { name: "lib", exts: new Set([".ts", ".tsx", ".js", ".jsx"]), filter: (p) => p.includes(`${path.sep}lib${path.sep}`) },
  { name: "sql", exts: new Set([".sql"]), filter: (p) => p.includes(`${path.sep}supabase${path.sep}`) },
  { name: "css", exts: new Set([".css"]), filter: (p) => p.endsWith(".css") },
  { name: "config", exts: new Set([".js", ".json"]), filter: (p) => /next\.config\.js$|tailwind\.config\.js$|postcss\.config\.js$|tsconfig\.json$|\.eslintrc\.json$|package\.json$/.test(p) }
];

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) {
      // still allow dotfiles like .eslintrc.json, but skip dot-directories
      if (e.isDirectory()) continue;
    }

    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);

    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(full, out);
      continue;
    }

    if (IGNORE_FILES.has(e.name)) continue;
    out.push(full);
  }
}

function countLines(filePath) {
  const buf = fs.readFileSync(filePath);
  // count '\n' + last line if file not empty
  let lines = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) lines++;
  if (buf.length > 0 && buf[buf.length - 1] !== 10) lines++;
  return lines;
}

const files = [];
walk(ROOT, files);

const totals = new Map();
let grandTotal = 0;

for (const f of files) {
  const ext = path.extname(f);
  const rel = path.relative(ROOT, f);

  // skip most dotfiles except known configs
  if (path.basename(rel).startsWith(".")) {
    const allow = rel === ".eslintrc.json";
    if (!allow) continue;
  }

  const group = EXT_GROUPS.find((g) => g.exts.has(ext) && g.filter(f));
  if (!group) continue;

  const n = countLines(f);
  grandTotal += n;
  totals.set(group.name, (totals.get(group.name) ?? 0) + n);
}

function fmt(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

console.log("LOC (excluding lockfiles/vendor):");
for (const g of EXT_GROUPS.map((x) => x.name)) {
  if (!totals.has(g)) continue;
  console.log(`- ${g}: ${fmt(totals.get(g))}`);
}
console.log(`Total: ${fmt(grandTotal)}`);
