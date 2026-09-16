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
CATALOG = Path("public/catalog/index_coberturas.json")


def normalized_keys(item: dict) -> set[str]:
    slug = str(item.get("slug", "")).strip()
    item_id = str(item.get("id", "")).strip()
    map_id = str(item.get("mapId", "")).strip()
    download = str(item.get("download", "")).strip()
    download_slug = Path(download).stem if download else ""
    return {
        slug,
        item_id.removeprefix("vf-"),
        map_id.removeprefix("vf-"),
        download_slug,
    }


def remove_stale_files() -> None:
    for slug in sorted(DISCARDED_SLUGS):
        p = AMBIENTAL_DIR / f"{slug}.geojson"
        if p.exists():
            p.unlink()
            print(f"Eliminado del artefacto: {p}")


def clean_json_items(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(path)
    doc = json.loads(path.read_text(encoding="utf-8"))
    items = doc.get("items", [])
    before = len(items)
    kept = []
    removed = []
    for item in items:
        if not isinstance(item, dict):
            kept.append(item)
            continue
        if normalized_keys(item) & DISCARDED_SLUGS:
            removed.append(item.get("slug") or item.get("id") or item.get("mapId") or item.get("nombre"))
            continue
        kept.append(item)
    doc["items"] = kept
    doc["total"] = len(kept)
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{label}: {before} -> {len(kept)} capas")
    for x in removed:
        print(f"Retirada: {x}")


if __name__ == "__main__":
    remove_stale_files()
    clean_json_items(MANIFEST, "Manifest ambiental")
    clean_json_items(CATALOG, "Índice principal")
