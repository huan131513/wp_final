/* eslint-disable no-console */
/**
 * Import 7-ELEVEN locations CSV into Prisma `Location`.
 *
 * Expected CSV is produced by `python_script/data_loader.py` (includes poiid/address/x_raw/y_raw columns).
 *
 * Usage:
 *   node scripts/import-711-locations.js --csv python_script/711_locations.csv
 *   node scripts/import-711-locations.js --csv python_script/711_locations.csv --dry-run
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

let prisma = null;

function tryLoadDotEnv() {
  // Cursor/this workspace may filter `.env` from read tools, but Node runtime can still read it.
  // We'll attempt `.env` and `.env.local` if they exist.
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
        // strip surrounding quotes
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
  const args = { csv: "", dryRun: false, limit: 0, databaseUrl: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--csv") args.csv = argv[++i] || "";
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--limit") args.limit = Number(argv[++i] || "0") || 0;
    else if (a === "--database-url") args.databaseUrl = argv[++i] || "";
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`\nImport 7-ELEVEN CSV into DB\n
Usage:
  node scripts/import-711-locations.js --csv <path>
  node scripts/import-711-locations.js --csv <path> --dry-run
  node scripts/import-711-locations.js --csv <path> --limit 100
  node scripts/import-711-locations.js --csv <path> --database-url "<DATABASE_URL>"

Notes:
  - Dedup uses exact (name, lat, lng) match to avoid duplicates.
  - Requires DATABASE_URL env configured for Prisma, or pass --database-url.\n`);
}

/**
 * Minimal CSV line parser (supports quotes + escaped quotes).
 */
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
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function toBool(v) {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function toFloatOrNull(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function buildDescription(existingDescription, address) {
  let desc = String(existingDescription || "").trim();

  // Ensure we keep address somewhere even if description is empty
  if (!desc && address) desc = `地址：${address}`;

  return desc;
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

  // Use the same adapter approach as the app (`src/lib/prisma.ts`) to avoid runtime issues.
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  const csvPath = path.resolve(process.cwd(), args.csv);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(content);

  console.log(`✅ Loaded CSV rows: ${rows.length}`);
  if (args.limit > 0) console.log(`ℹ️ Limit enabled: ${args.limit}`);
  if (args.dryRun) console.log("ℹ️ DRY RUN (no DB writes)");

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  const limit = args.limit > 0 ? Math.min(args.limit, rows.length) : rows.length;

  for (let i = 0; i < limit; i++) {
    const r = rows[i];
    const poiid = String(r.poiid || "").trim();
    const name = String(r.name || "").trim();
    const type = String(r.type || "TOILET").trim() || "TOILET";
    const lat = toFloatOrNull(r.lat);
    const lng = toFloatOrNull(r.lng);
    const address = String(r.address || "").trim();

    if (!name || lat == null || lng == null) {
      invalid++;
      continue;
    }

    let existing = null;
    existing = await prisma.location.findFirst({
      where: { name, lat, lng },
    });

    const description = buildDescription(r.description, address);

    const data = {
      name,
      description,
      type,
      lat,
      lng,
      floor: String(r.floor || "").trim() || null,
      hasTissue: toBool(r.hasTissue),
      hasDryer: toBool(r.hasDryer),
      hasSeat: toBool(r.hasSeat),
      hasDiaperTable: toBool(r.hasDiaperTable),
      hasWaterDispenser: toBool(r.hasWaterDispenser),
      hasAutoDoor: toBool(r.hasAutoDoor),
      hasHandrail: toBool(r.hasHandrail),
    };

    if (args.dryRun) {
      if (existing) updated++;
      else created++;
      continue;
    }

    if (existing) {
      // update in place
      await prisma.location.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.location.create({ data });
      created++;
    }
  }

  // Anything beyond limit is "skipped by limit"
  if (limit < rows.length) skipped = rows.length - limit;

  console.log("------------------------------------------------------------");
  console.log(`✅ Done. created=${created}, updated=${updated}, invalid=${invalid}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });


