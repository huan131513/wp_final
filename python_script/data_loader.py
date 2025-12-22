"""
Convert 7-ELEVEN iMapSDKOutput XML (e.g. 711_data.xml) to a CSV that can be imported
into this project's Prisma `Location` model.

Why rewrite:
- BeautifulSoup is not a real XML parser (and can silently break tag casing / structure).
- This XML can be huge (often one-line). `xml.etree.ElementTree.iterparse` is safer.

Output CSV columns are aligned to Prisma `Location` fields (plus some extra debug columns).
"""

from __future__ import annotations

import argparse
import csv
import sys
import xml.etree.ElementTree as ET
from typing import Dict, Iterable, Optional, Tuple


def _safe_text(elem: Optional[ET.Element]) -> str:
    if elem is None or elem.text is None:
        return ""
    return elem.text.strip()


def _parse_float(s: str) -> Optional[float]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _normalize_lng_lat(x_raw: str, y_raw: str) -> Tuple[Optional[float], Optional[float]]:
    """
    XML has X/Y which are usually:
    - X=121532554, Y=25017604  -> lng=121.532554, lat=25.017604 (micro-degrees)
    - Sometimes already decimals: X=121547625.389473
    """
    x = _parse_float(x_raw)
    y = _parse_float(y_raw)
    if x is None or y is None:
        return None, None

    # Heuristic: values > 1000 are very likely micro-degrees scaled by 1e6
    if abs(x) > 1000:
        x = x / 1_000_000.0
    if abs(y) > 1000:
        y = y / 1_000_000.0

    # Basic sanity check for Taiwan-ish coords; if outside, keep but warn via caller
    return x, y


def _element_to_dict_case_insensitive(parent: ET.Element) -> Dict[str, str]:
    """
    Create a lowercase-tag -> text mapping so we don't care about tag casing.
    """
    out: Dict[str, str] = {}
    for child in list(parent):
        tag = (child.tag or "").strip().lower()
        out[tag] = _safe_text(child)
    return out


def iter_711_stores(xml_path: str) -> Iterable[Dict[str, str]]:
    """
    Yields each GeoPosition as a dict (case-insensitive keys).
    Uses streaming parse to reduce memory usage.
    """
    # iterparse supports huge XML better than reading the whole file
    context = ET.iterparse(xml_path, events=("end",))
    for event, elem in context:
        tag_lower = (elem.tag or "").strip().lower()
        if tag_lower == "geoposition":
            data = _element_to_dict_case_insensitive(elem)
            yield data
            elem.clear()


def build_location_row(store: Dict[str, str]) -> Tuple[Dict[str, object], Dict[str, object]]:
    """
    Returns:
    - prisma_row: columns aligned to Prisma `Location`
    - debug_row: extra fields helpful for audit/debug/import scripts
    """
    poiid = store.get("poiid", "")
    name = store.get("poiname", "").strip()
    address = store.get("address", "").strip()
    tel = store.get("telno", "").strip()
    op_time = store.get("op_time", "").strip()
    services = store.get("storeimagetitle", "").strip()

    lng, lat = _normalize_lng_lat(store.get("x", ""), store.get("y", ""))
    has_toilet = "02廁所" in (services or "")

    # Prisma Location doesn't have `address` column now.
    # We embed address into description so it isn't lost.
    # Keep description minimal for current DB/UI:
    # "地址：...；電話：...；營業時間：...；"
    desc_parts = []
    if address:
        desc_parts.append(f"地址：{address}")
    if tel:
        desc_parts.append(f"電話：{tel}")
    if op_time:
        desc_parts.append(f"營業時間：{op_time}")
    description = ("；".join(desc_parts) + "；") if desc_parts else None

    prisma_row: Dict[str, object] = {
        # Prisma Location fields
        "name": f"7-ELEVEN {name}" if name else "7-ELEVEN",
        "description": description or "",
        "type": "TOILET",  # These are toilet points on our map
        "lat": lat if lat is not None else "",
        "lng": lng if lng is not None else "",
        "floor": "",
        # Common facilities (unknown from XML; keep defaults)
        "hasTissue": False,
        "hasDryer": False,
        # Toilet specific (unknown)
        "hasSeat": False,
        # Nursing room
        "hasDiaperTable": False,
        "hasWaterDispenser": False,
        "hasAutoDoor": False,
        # Accessible toilet
        "hasHandrail": False,
    }

    debug_row: Dict[str, object] = {
        "source": "7-ELEVEN iMapSDKOutput",
        "poiid": poiid,
        "poiname": name,
        "address": address,
        "telno": tel,
        "op_time": op_time,
        "services": services,
        "x_raw": store.get("x", ""),
        "y_raw": store.get("y", ""),
        "has_toilet_service_tag": has_toilet,
    }

    return prisma_row, debug_row


def export_csv(
    input_xml: str,
    output_csv: str,
    only_toilets: bool,
    include_debug: bool,
) -> None:
    total = 0
    written = 0
    missing_coord = 0
    suspicious_coord = 0

    # Field order: Prisma-aligned first, then optional debug columns.
    prisma_fields = [
        "name",
        "description",
        "type",
        "lat",
        "lng",
        "floor",
        "hasTissue",
        "hasDryer",
        "hasSeat",
        "hasDiaperTable",
        "hasWaterDispenser",
        "hasAutoDoor",
        "hasHandrail",
    ]
    debug_fields = [
        "source",
        "poiid",
        "poiname",
        "address",
        "telno",
        "op_time",
        "services",
        "x_raw",
        "y_raw",
        "has_toilet_service_tag",
    ]
    fieldnames = prisma_fields + (debug_fields if include_debug else [])

    with open(output_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for store in iter_711_stores(input_xml):
            total += 1
            prisma_row, debug_row = build_location_row(store)

            services = str(debug_row.get("services", "") or "")
            has_toilet = "02廁所" in services
            if only_toilets and not has_toilet:
                continue

            lat = prisma_row.get("lat")
            lng = prisma_row.get("lng")
            if lat == "" or lng == "":
                missing_coord += 1
            else:
                # sanity check (Taiwan range-ish)
                try:
                    lat_f = float(lat)  # type: ignore[arg-type]
                    lng_f = float(lng)  # type: ignore[arg-type]
                    if not (20.0 <= lat_f <= 27.0 and 118.0 <= lng_f <= 123.5):
                        suspicious_coord += 1
                except Exception:
                    pass

            row = dict(prisma_row)
            if include_debug:
                row.update(debug_row)
            writer.writerow(row)
            written += 1
            
            print("-" * 60)
    print(f"✅ Input XML: {input_xml}")
    print(f"✅ Output CSV: {output_csv}")
    print(f"總 GeoPosition: {total}")
    print(f"輸出筆數: {written} (only_toilets={only_toilets})")
    print(f"缺少座標筆數: {missing_coord}")
    print(f"座標可疑筆數(超出台灣範圍): {suspicious_coord}")
    print("-" * 60)

    if missing_coord > 0:
        print("⚠️ 有些門市缺少座標欄位 (X/Y)。可用解法見下方說明。")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert 7-ELEVEN XML to CSV for Toilet Map DB import."
    )
    parser.add_argument(
        "--input",
        default="711_data.xml",
        help="Path to 7-ELEVEN XML file (default: 711_data.xml)",
    )
    parser.add_argument(
        "--output",
        default="711_locations.csv",
        help="Output CSV path (default: 711_locations.csv)",
    )
    parser.add_argument(
        "--only-toilets",
        action="store_true",
        help="Only export stores whose services contain '02廁所'",
    )
    parser.add_argument(
        "--no-debug",
        action="store_true",
        help="Do not include debug columns (poiid/address/services/x_raw/y_raw...)",
    )

    args = parser.parse_args()

    try:
        export_csv(
            input_xml=args.input,
            output_csv=args.output,
            only_toilets=bool(args.only_toilets),
            include_debug=not bool(args.no_debug),
        )
        return 0
    except FileNotFoundError:
        print(f"❌ 找不到檔案：{args.input}")
        return 1
    except ET.ParseError as e:
        print(f"❌ XML 解析失敗：{e}")
        return 1
    except Exception as e:
        print(f"❌ 發生非預期錯誤：{e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())