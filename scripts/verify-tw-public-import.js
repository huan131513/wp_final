/* eslint-disable no-console */
/**
 * Verify that each location derived from `tw_public.txt` exists in DB.
 *
 * Matching key: exact (name, lat, lng) using the same derivation as import script defaults.
 *
 * Usage:
 *   node scripts/verify-tw-public-import.js
 *   node scripts/verify-tw-public-import.js --file python_script/tw_public.txt
 *   node scripts/verify-tw-public-import.js --database-url "postgresql://..."
 *   node scripts/verify-tw-public-import.js --type-mode accessible-only
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
  const args = {
    file: "python_script/tw_public.txt",
    databaseUrl: "",
    group: true,
    skipClosed: true,
    typeMode: "all-toilet", // all-toilet | accessible-if-any | accessible-only
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i] || args.file;
    else if (a === "--database-url") args.databaseUrl = argv[++i] || "";
    else if (a === "--type-mode") args.typeMode = (argv[++i] || "").trim() || args.typeMode;
    else if (a === "--no-group") args.group = false;
    else if (a === "--no-skip-closed") args.skipClosed = false;
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`\nVerify tw_public import\n
Usage:
  node scripts/verify-tw-public-import.js
  node scripts/verify-tw-public-import.js --file <path>
  node scripts/verify-tw-public-import.js --database-url "<DATABASE_URL>"
  node scripts/verify-tw-public-import.js --type-mode all-toilet|accessible-if-any|accessible-only\n`);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalizeSpaces(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/全天開\s+放/g, "全天開放")
    .trim();
}

function toFixed7(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Number(x.toFixed(7)) : null;
}

function baseName(ctrlName) {
  const s = String(ctrlName || "").trim();
  if (!s) return "";
  const tokens = [
    "無障礙親子",
    "無障礙",
    "親子廁所",
    "親子",
    "性別友善左",
    "性別友善右",
    "性別友善",
    "男女",
    "男-女",
    "混合廁",
    "男",
    "女",
  ];
  for (const t of tokens) {
    if (s.endsWith(t)) {
      const cut = s.slice(0, -t.length).trim();
      if (cut) return cut;
    }
  }
  return s;
}

function buildOpenTimeFromProperties(p) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const starts = days.map((k) => normalizeSpaces(p[`${k}Start`]));
  const ends = days.map((k) => normalizeSpaces(p[`${k}End`]));
  const allSameStart = starts.every((s) => s === starts[0]);
  const allEmptyEnd = ends.every((e) => !e);
  if (allSameStart && allEmptyEnd) return starts[0] || "";
  return starts[0] || "";
}

function groupKey(lat, lng, addr) {
  return `${Number(lat).toFixed(7)}|${Number(lng).toFixed(7)}|${String(addr || "").trim()}`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  tryLoadDotEnv();
  const connectionString = args.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const outer = safeJsonParse(raw);
  if (!outer || typeof outer.d !== "string") {
    console.error("❌ Unexpected format: expected outer JSON with string field `d`.");
    process.exit(1);
  }
  const inner = safeJsonParse(outer.d);
  if (!inner || !Array.isArray(inner.features)) {
    console.error("❌ Unexpected format: expected inner GeoJSON with `features` array.");
    process.exit(1);
  }

  const features = inner.features;
  const expected = [];

  if (!args.group) {
    for (const ft of features) {
      const p = ft.properties || {};
      const coords = (ft.geometry && ft.geometry.coordinates) || [];
      const lng = toFixed7(coords[0]);
      const lat = toFixed7(coords[1]);
      if (lat == null || lng == null) continue;

      const openTime = normalizeSpaces(buildOpenTimeFromProperties(p));
      if (args.skipClosed && openTime === "全天關閉") continue;

      const isAccessible = String(p.toilet_type || "").trim() === "4";
      const isFamily = String(p.toilet_type || "").trim() === "3";
      let expectedType = "TOILET";
      if (args.typeMode === "accessible-if-any" && (isAccessible || isFamily)) {
        expectedType = "ACCESSIBLE_TOILET";
      } else if (args.typeMode === "accessible-only" && isAccessible) {
        expectedType = "ACCESSIBLE_TOILET";
      }

      expected.push({
        name: baseName(p.ctrl_name) || "未命名公共廁所",
        lat,
        lng,
        expectedType,
      });
    }
  } else {
    const groups = new Map();
    for (const ft of features) {
      const p = ft.properties || {};
      const coords = (ft.geometry && ft.geometry.coordinates) || [];
      const lng = toFixed7(coords[0]);
      const lat = toFixed7(coords[1]);
      if (lat == null || lng == null) continue;
      const addr = normalizeSpaces(p.ctrl_addr);
      const k = groupKey(lat, lng, addr);
      if (!groups.has(k))
        groups.set(k, { lat, lng, addr, names: [], openTime: "", toiletTypes: new Set() });
      const g = groups.get(k);
      g.names.push(String(p.ctrl_name || "").trim());
      if (!g.openTime) g.openTime = normalizeSpaces(buildOpenTimeFromProperties(p));
      const t = String(p.toilet_type || "").trim();
      if (t) g.toiletTypes.add(t);
    }
    for (const g of groups.values()) {
      if (args.skipClosed && g.openTime === "全天關閉") continue;
      const bases = g.names
        .map((n) => baseName(n))
        .filter(Boolean)
        .sort((a, b) => a.length - b.length);
      const hasAccessible = g.toiletTypes.has("4");
      const hasFamily = g.toiletTypes.has("3");
      let expectedType = "TOILET";
      if (args.typeMode === "accessible-if-any" && (hasAccessible || hasFamily)) {
        expectedType = "ACCESSIBLE_TOILET";
      } else if (args.typeMode === "accessible-only" && hasAccessible) {
        expectedType = "ACCESSIBLE_TOILET";
      }

      expected.push({
        name: bases[0] || baseName(g.names[0]) || "未命名公共廁所",
        lat: g.lat,
        lng: g.lng,
        expectedType,
      });
    }
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    let missing = 0;
    const missingSamples = [];
    let typeMismatch = 0;
    const typeMismatchSamples = [];

    // N=171 (grouped) is small; do per-row lookup for correctness.
    for (const e of expected) {
      const found = await prisma.location.findFirst({
        where: { name: e.name, lat: e.lat, lng: e.lng },
        select: { id: true, type: true },
      });
      if (!found) {
        missing++;
        if (missingSamples.length < 20) missingSamples.push(e);
        continue;
      }
      if (found.type !== e.expectedType) {
        typeMismatch++;
        if (typeMismatchSamples.length < 20) {
          typeMismatchSamples.push({
            name: e.name,
            lat: e.lat,
            lng: e.lng,
            expectedType: e.expectedType,
            actualType: found.type,
          });
        }
      }
    }

    console.log("------------------------------------------------------------");
    console.log(`✅ Expected locations: ${expected.length}`);
    console.log(`❌ Missing in DB: ${missing}`);
    console.log(`⚠️ Type mismatch: ${typeMismatch} (typeMode=${args.typeMode})`);
    if (missingSamples.length) {
      console.log("\nMissing samples (first 20):");
      for (const m of missingSamples) {
        console.log(`- ${m.name} lat=${m.lat} lng=${m.lng} expectedType=${m.expectedType}`);
      }
    }
    if (typeMismatchSamples.length) {
      console.log("\nType mismatch samples (first 20):");
      for (const t of typeMismatchSamples) {
        console.log(
          `- ${t.name} lat=${t.lat} lng=${t.lng} expected=${t.expectedType} actual=${t.actualType}`
        );
      }
    }
    console.log("------------------------------------------------------------");
    if (missing || typeMismatch) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Verify failed:", e);
  process.exit(1);
});


