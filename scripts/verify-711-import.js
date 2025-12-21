/* eslint-disable no-console */
/**
 * Verify that every row from the 7-ELEVEN CSV exists in Prisma `Location`.
 *
 * Matching key: exact (name, lat, lng).
 *
 * Usage:
 *   node scripts/verify-711-import.js --csv python_script/711_locations.csv
 *   node scripts/verify-711-import.js --csv python_script/711_locations.csv --database-url "postgresql://..."
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

function tryLoadDotEnv() {
  const candidates = [".env", ".env.local"];
  for (const rel of candidates) {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) continue;
    try {
      const content = fs.readFileSync(p, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx <= 0) continue;
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch {
      // ignore
    }
  }
}

function parseArgs(argv) {
  const args = { csv: "", databaseUrl: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--csv") args.csv = argv[++i] || "";
    else if (a === "--database-url") args.databaseUrl = argv[++i] || "";
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`\nVerify 7-ELEVEN import\n
Usage:
  node scripts/verify-711-import.js --csv <path>
  node scripts/verify-711-import.js --csv <path> --database-url "<DATABASE_URL>"

Env:
  - DATABASE_URL (or pass --database-url)\n`);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(content) {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cols[j] ?? "";
    rows.push(row);
  }
  return rows;
}

function num(v) {
  const n = Number(String(v || "").trim());
  return Number.isFinite(n) ? n : null;
}

function keyOf(name, lat, lng) {
  // Normalize floats to avoid tiny representation issues.
  return `${String(name).trim()}|${Number(lat).toFixed(7)}|${Number(lng).toFixed(7)}`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.csv) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  tryLoadDotEnv();

  const connectionString = args.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set.");
    console.error('   - PowerShell example: $env:DATABASE_URL="postgresql://..."');
    console.error("   - Or pass: --database-url \"postgresql://...\"");
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), args.csv);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const csvKeys = new Map();
  let csvInvalid = 0;
  for (const r of rows) {
    const name = String(r.name || "").trim();
    const lat = num(r.lat);
    const lng = num(r.lng);
    if (!name || lat == null || lng == null) {
      csvInvalid++;
      continue;
    }
    csvKeys.set(keyOf(name, lat, lng), r);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const locations = await prisma.location.findMany({
      where: { name: { startsWith: "7-ELEVEN" } },
      select: { id: true, name: true, type: true, lat: true, lng: true },
    });

    const dbKeys = new Map();
    for (const loc of locations) {
      dbKeys.set(keyOf(loc.name, loc.lat, loc.lng), loc);
    }

    const missing = [];
    for (const [k, r] of csvKeys.entries()) {
      if (!dbKeys.has(k)) {
        missing.push({
          name: String(r.name || "").trim(),
          lat: String(r.lat || "").trim(),
          lng: String(r.lng || "").trim(),
          poiid: String(r.poiid || "").trim(),
        });
      }
    }

    console.log("------------------------------------------------------------");
    console.log(`✅ CSV rows (valid coords): ${csvKeys.size} (invalid skipped: ${csvInvalid})`);
    console.log(`✅ DB rows (name startsWith "7-ELEVEN"): ${dbKeys.size}`);
    console.log(`❌ Missing in DB: ${missing.length}`);

    if (missing.length) {
      console.log("\nMissing rows (first 20):");
      for (const m of missing.slice(0, 20)) {
        console.log(`- ${m.name} lat=${m.lat} lng=${m.lng}${m.poiid ? ` (POIID:${m.poiid})` : ""}`);
      }
    }
    console.log("------------------------------------------------------------");

    if (missing.length) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Verify failed:", e);
  process.exit(1);
});


