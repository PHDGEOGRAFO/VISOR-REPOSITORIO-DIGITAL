from __future__ import annotations

import json
from pathlib import Path

# Coberturas descartadas oficialmente: no deben aparecer en el visor,
# en el índice ni en el artefacto publicado.
DISCARDED_SLUGS = {
    "amb-pol-ndvi-stgo-oct-2025",
    "iat5-ndvi-bar-2023",
    "iat5-ndvi-bar-2025",
    "iat5-ndvi-mz-2023",
    "iat5-ndvi-mz-2025",
    "iat5-ndvi-ter-2023",
    "iat5-ndvi-ter-2025",
}

AMBIENTAL_DIR = Path("public/data/ambiental")
MANIFEST = AMBIENTAL_DIR / "manifest_02_dim_ambiental_vf.json"


def remove_stale_files() -> None:
    for slug in sorted(DISCARDED_SLUGS):
        p = AMBIENTAL_DIR / f"{slug}.geojson"
        if p.exists():
            p.unlink()
            print(f"Eliminado del artefacto: {p}")


def clean_manifest() -> None:
    if not MANIFEST.exists():
        raise FileNotFoundError(MANIFEST)
    doc = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = doc.get("items", [])
    before = len(items)
    kept = []
    removed = []
    for item in items:
        slug = str(item.get("slug", "")).strip()
        item_id = str(item.get("id", "")).strip()
        map_id = str(item.get("mapId", "")).strip()
        normalized = {slug, item_id.removeprefix("vf-"), map_id.removeprefix("vf-")}
        if normalized & DISCARDED_SLUGS:
            removed.append(slug or item_id or map_id)
            continue
        kept.append(item)
    doc["items"] = kept
    doc["total"] = len(kept)
    MANIFEST.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Manifest ambiental: {before} -> {len(kept)} capas")
    for x in removed:
        print(f"Retirada del catálogo: {x}")


if __name__ == "__main__":
    remove_stale_files()
    clean_manifest()
