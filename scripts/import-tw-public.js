/* eslint-disable no-console */
/**
 * Import public toilet dataset from `python_script/tw_public.txt` into Prisma `Location`.
 *
 * `tw_public.txt` format (as observed):
 *  - outer JSON: { "d": "<stringified GeoJSON FeatureCollection>" }
 *  - inner JSON: GeoJSON with features[].geometry.coordinates = [lng, lat]
 *
 * Usage:
 *   node scripts/import-tw-public.js
 *   node scripts/import-tw-public.js --file python_script/tw_public.txt --dry-run
 *   node scripts/import-tw-public.js --limit 50
 *
 * Flags:
 *   --file <path>              Input file (default: python_script/tw_public.txt)
 *   --dry-run                  No DB writes
 *   --limit <n>                Limit number of grouped locations processed
 *   --no-group                 Do not group; import each feature as a Location (NOT recommended)
 *   --skip-closed              Skip records with "全天關閉" (default: true)
 *   --no-skip-closed           Do not skip closed records
 *   --type-mode <mode>         all-toilet | accessible-if-any | accessible-only (default: all-toilet)
 *   --include-level            Append "等級：..." into description (default: true)
 *   --no-include-level         Do not include level in description
 *   --include-types            Append "廁所類型：..." into description (default: false)
 *   --export-csv <path>        Export the prepared (post-group/filter) dataset to CSV (UTF-8 with BOM)
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

let prisma = null;

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
    dryRun: false,
    limit: 0,
    group: true,
    skipClosed: true,
    typeMode: "all-toilet", // all-toilet | accessible-if-any | accessible-only
    includeLevel: true,
    includeTypes: false,
    exportCsv: "",
    databaseUrl: "",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i] || args.file;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--limit") args.limit = Number(argv[++i] || "0") || 0;
    else if (a === "--no-group") args.group = false;
    else if (a === "--skip-closed") args.skipClosed = true;
    else if (a === "--no-skip-closed") args.skipClosed = false;
    else if (a === "--type-mode") args.typeMode = (argv[++i] || "").trim();
    else if (a === "--include-level") args.includeLevel = true;
    else if (a === "--no-include-level") args.includeLevel = false;
    else if (a === "--include-types") args.includeTypes = true;
    else if (a === "--export-csv") args.exportCsv = argv[++i] || "";
    else if (a === "--database-url") args.databaseUrl = argv[++i] || "";
    else if (a === "-h" || a === "--help") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`\nImport tw_public.txt into DB\n
Usage:
  node scripts/import-tw-public.js
  node scripts/import-tw-public.js --file python_script/tw_public.txt --dry-run
  node scripts/import-tw-public.js --dry-run --export-csv python_script/tw_public_import_ready.csv
  node scripts/import-tw-public.js --limit 50

Env:
  - DATABASE_URL (or pass --database-url). Not required when using --dry-run.\n`);
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

function buildOpenTimeFromProperties(p) {
  const days = [
    ["Mon", "週一"],
    ["Tue", "週二"],
    ["Wed", "週三"],
    ["Thu", "週四"],
    ["Fri", "週五"],
    ["Sat", "週六"],
    ["Sun", "週日"],
  ];

  const starts = days.map(([k]) => normalizeSpaces(p[`${k}Start`]));
  const ends = days.map(([k]) => normalizeSpaces(p[`${k}End`]));

  // If all start are same and all end are empty → use the single string.
  const allSameStart = starts.every((s) => s === starts[0]);
  const allEmptyEnd = ends.every((e) => !e);
  if (allSameStart && allEmptyEnd) return starts[0] || "";

  // Otherwise, build a compact per-day string. (May be longer, but only used when needed.)
  const parts = [];
  for (let i = 0; i < days.length; i++) {
    const label = days[i][1];
    const s = starts[i];
    const e = ends[i];
    if (!s && !e) continue;
    parts.push(`${label}${e ? ` ${s}-${e}` : ` ${s}`}`.trim());
  }
  return parts.join("；");
}

const TOILET_TYPE_LABEL = {
  "1": "男",
  "2": "女",
  "3": "親子",
  "4": "無障礙",
  "5": "男女/混合",
  "6": "性別友善",
};

function baseName(ctrlName) {
  const s = String(ctrlName || "").trim();
  if (!s) return "";

  // Try to strip common suffix tokens to get a stable "place name".
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

function buildDescription({ addr, tel, openTime, level, typeLabels }, opts) {
  const parts = [];
  if (addr) parts.push(`地址：${addr}`);
  if (tel) parts.push(`電話：${tel}`);
  if (openTime) parts.push(`開放時間：${openTime}`);
  if (opts.includeLevel && level) parts.push(`等級：${level}`);
  if (opts.includeTypes && typeLabels && typeLabels.length) {
    parts.push(`廁所類型：${typeLabels.join("、")}`);
  }
  return parts.length ? `${parts.join("；")}；` : null;
}

function groupKey(lat, lng, addr) {
  // Using 7 decimals should be stable enough for grouping same point.
  return `${Number(lat).toFixed(7)}|${Number(lng).toFixed(7)}|${String(addr || "").trim()}`;
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsvFile(outPath, rows) {
  const abs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const headers = [
    "name",
    "type",
    "lat",
    "lng",
    "address",
    "tel",
    "openTime",
    "level",
    "typeLabels",
    "description",
    "groupSize",
    "source",
  ];

  const lines = [];
  lines.push(headers.join(","));
  for (const r of rows) {
    const obj = {
      name: r.name || "",
      type: r.type || "",
      lat: r.lat ?? "",
      lng: r.lng ?? "",
      address: r.addr || "",
      tel: r.tel || "",
      openTime: r.openTime || "",
      level: r.level || "",
      typeLabels: Array.isArray(r.typeLabels) ? r.typeLabels.join("、") : "",
      description: r.description || "",
      groupSize: r.groupSize ?? "",
      source: r.source || "",
    };
    lines.push(headers.map((h) => csvEscape(obj[h])).join(","));
  }

  // UTF-8 BOM so Excel on Windows opens Chinese text correctly.
  fs.writeFileSync(abs, "\ufeff" + lines.join("\r\n"), "utf8");
  return abs;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  tryLoadDotEnv();

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
  console.log(`✅ Loaded features: ${features.length}`);
  console.log(`ℹ️ group=${args.group} skipClosed=${args.skipClosed} typeMode=${args.typeMode}`);
  if (args.dryRun) console.log("ℹ️ DRY RUN (no DB writes)");

  const records = [];
  if (!args.group) {
    for (const ft of features) {
      const p = ft.properties || {};
      const coords = (ft.geometry && ft.geometry.coordinates) || [];
      const lng = toFixed7(coords[0]);
      const lat = toFixed7(coords[1]);
      if (lat == null || lng == null) continue;

      const openTime = buildOpenTimeFromProperties(p);
      if (args.skipClosed && normalizeSpaces(openTime) === "全天關閉") continue;

      const name = baseName(p.ctrl_name) || "未命名公共廁所";
      const addr = normalizeSpaces(p.ctrl_addr);
      const tel = normalizeSpaces(p.admin_tel);
      const level = normalizeSpaces(p.NewestToiletLevel || p.last_level);
      const toiletTypeLabel = TOILET_TYPE_LABEL[String(p.toilet_type || "").trim()] || "";
      const desc = buildDescription(
        { addr, tel, openTime: normalizeSpaces(openTime), level, typeLabels: toiletTypeLabel ? [toiletTypeLabel] : [] },
        args
      );

      const isAccessible = String(p.toilet_type || "").trim() === "4";
      const isFamily = String(p.toilet_type || "").trim() === "3";
      let locationType = "TOILET";
      if (args.typeMode === "accessible-if-any" && (isAccessible || isFamily)) {
        locationType = "ACCESSIBLE_TOILET";
      } else if (args.typeMode === "accessible-only" && isAccessible) {
        locationType = "ACCESSIBLE_TOILET";
      }

      records.push({
        name,
        description: desc,
        type: locationType,
        lat,
        lng,
        addr,
        tel,
        openTime: normalizeSpaces(openTime),
        level,
        typeLabels: toiletTypeLabel ? [toiletTypeLabel] : [],
        groupSize: 1,
        source: "tw_public",
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
      if (!groups.has(k)) {
        groups.set(k, {
          lat,
          lng,
          addr,
          names: [],
          tel: "",
          openTime: "",
          levels: [],
          toiletTypes: new Set(),
          count: 0,
        });
      }
      const g = groups.get(k);
      g.names.push(String(p.ctrl_name || "").trim());
      if (!g.tel) g.tel = normalizeSpaces(p.admin_tel);
      if (!g.openTime) g.openTime = normalizeSpaces(buildOpenTimeFromProperties(p));
      const level = normalizeSpaces(p.NewestToiletLevel || p.last_level);
      if (level) g.levels.push(level);
      const t = String(p.toilet_type || "").trim();
      if (t) g.toiletTypes.add(t);
      g.count++;
    }

    console.log(`✅ Grouped locations: ${groups.size}`);

    for (const g of groups.values()) {
      const openTime = g.openTime;
      if (args.skipClosed && openTime === "全天關閉") continue;

      // Choose a stable name from the group: take the shortest baseName among names.
      const bases = g.names
        .map((n) => baseName(n))
        .filter(Boolean)
        .sort((a, b) => a.length - b.length);
      const name = bases[0] || baseName(g.names[0]) || "未命名公共廁所";

      const typeLabels = Array.from(g.toiletTypes)
        .map((t) => TOILET_TYPE_LABEL[t])
        .filter(Boolean);

      const hasAccessible = g.toiletTypes.has("4");
      const hasFamily = g.toiletTypes.has("3");
      let locationType = "TOILET";
      if (args.typeMode === "accessible-if-any" && (hasAccessible || hasFamily)) {
        locationType = "ACCESSIBLE_TOILET";
      } else if (args.typeMode === "accessible-only" && hasAccessible) {
        locationType = "ACCESSIBLE_TOILET";
      }

      const bestLevel = g.levels.find((x) => x === "優等級") || g.levels[0] || "";

      records.push({
        name,
        description: buildDescription(
          { addr: g.addr, tel: g.tel, openTime, level: bestLevel, typeLabels },
          args
        ),
        type: locationType,
        lat: g.lat,
        lng: g.lng,
        addr: g.addr,
        tel: g.tel,
        openTime,
        level: bestLevel,
        typeLabels,
        groupSize: g.count || g.names.length || "",
        source: "tw_public",
      });
    }
  }

  // Apply limit after filtering/grouping
  const limit = args.limit > 0 ? Math.min(args.limit, records.length) : records.length;
  const toProcess = records.slice(0, limit);
  console.log(`✅ Prepared records: ${records.length} (processing: ${toProcess.length})`);

  if (args.exportCsv) {
    const exported = writeCsvFile(args.exportCsv, toProcess);
    console.log(`✅ CSV exported: ${exported}`);
  }

  // If user only wants CSV, allow `--dry-run` without touching DB at all.
  if (args.dryRun) {
    console.log("------------------------------------------------------------");
    console.log("✅ Dry-run complete (skipped DB connection/writes).");
    console.log("------------------------------------------------------------");
    return;
  }

  const connectionString = args.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set.");
    console.error('   - PowerShell example: $env:DATABASE_URL="postgresql://..."');
    console.error("   - Or pass: --database-url \"postgresql://...\"");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;
  let invalid = 0;

  for (const r of toProcess) {
    if (!r.name || r.lat == null || r.lng == null) {
      invalid++;
      continue;
    }

    const existing = await prisma.location.findFirst({
      where: { name: r.name, lat: r.lat, lng: r.lng },
      select: { id: true },
    });

    const data = {
      name: r.name,
      description: r.description,
      type: r.type,
      lat: r.lat,
      lng: r.lng,
      floor: null,
      // Facilities are not reliably provided by this dataset (Equipment is always "0" in sample),
      // keep defaults false to avoid misleading users.
      hasTissue: false,
      hasDryer: false,
      hasSeat: false,
      hasDiaperTable: false,
      hasWaterDispenser: false,
      hasAutoDoor: false,
      hasHandrail: false,
    };

    if (args.dryRun) {
      if (existing) updated++;
      else created++;
      continue;
    }

    if (existing) {
      await prisma.location.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.location.create({ data });
      created++;
    }
  }

  console.log("------------------------------------------------------------");
  console.log(`✅ Done. created=${created}, updated=${updated}, invalid=${invalid}`);
  console.log("------------------------------------------------------------");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Import failed:", e);
  process.exit(1);
});


