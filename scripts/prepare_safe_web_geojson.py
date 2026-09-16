from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

# Versiones web seguras. Los GeoPackage de descarga y los archivos fuente del
# repositorio NO se modifican: este script corre solamente dentro del workspace
# temporal de GitHub Actions antes del build de Pages.
#
# Las coberturas NDVI antiguas fueron descartadas y no se procesan aquí. Los
# nuevos NDVI 2024/2025/2026 se incorporarán con su nombre oficial (año + mes)
# y podrán agregarse a SAFE_LAYERS cuando su GeoJSON web esté en el repositorio.
SAFE_LAYERS = {
    "Área Verde": Path("public/data/ambiental/amb-pol-areas-verdes.geojson"),
    "Área Verde PRC": Path("public/data/ambiental/amb-pol-averde-prc.geojson"),
    "Mascotas MZ 2026": Path("public/data/ambiental/amb-pol-mascotas-mz-2026.geojson"),
    "NDWI 2025": Path("public/data/ambiental/amb-pol-ndwi-stgo-2025.geojson"),
    "Plazas 2026": Path("public/data/ambiental/amb-pol-plazas-2026.geojson"),
    "Reciclaje por manzana": Path("public/data/ambiental/amb-pol-reciclaje-manzana.geojson"),
    "Reciclaje VF": Path("public/data/ambiental/amb-pol-reciclaje-vf.geojson"),
}

TOLERANCE_DEG = 0.000008  # aprox. submétrico en Santiago
MAX_RING_POINTS = 180
ROUND_DECIMALS = 6


def valid_point(p: Any) -> bool:
    if not isinstance(p, (list, tuple)) or len(p) < 2:
        return False
    x, y = p[0], p[1]
    if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
        return False
    if not math.isfinite(x) or not math.isfinite(y):
        return False
    return -180 <= x <= 180 and -90 <= y <= 90


def point_segment_distance_sq(p: list[float], a: list[float], b: list[float]) -> float:
    px, py = p[:2]
    ax, ay = a[:2]
    bx, by = b[:2]
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    qx, qy = ax + t * dx, ay + t * dy
    return (px - qx) ** 2 + (py - qy) ** 2


def douglas_peucker(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 2:
        return points
    tol_sq = tolerance * tolerance
    first, last = points[0], points[-1]
    max_dist = -1.0
    idx = -1
    for i in range(1, len(points) - 1):
        d = point_segment_distance_sq(points[i], first, last)
        if d > max_dist:
            idx, max_dist = i, d
    if max_dist > tol_sq and idx > 0:
        left = douglas_peucker(points[: idx + 1], tolerance)
        right = douglas_peucker(points[idx:], tolerance)
        return left[:-1] + right
    return [first, last]


def cap_points(points: list[list[float]], limit: int) -> list[list[float]]:
    if len(points) <= limit:
        return points
    if limit <= 2:
        return [points[0], points[-1]]
    span = len(points) - 1
    indexes = [round(i * span / (limit - 1)) for i in range(limit)]
    out: list[list[float]] = []
    last_idx = -1
    for idx in indexes:
        if idx != last_idx:
            out.append(points[idx])
            last_idx = idx
    if out[-1] != points[-1]:
        out.append(points[-1])
    return out


def sanitize_ring(raw_ring: Any) -> list[list[float]] | None:
    if not isinstance(raw_ring, list):
        return None
    pts = [
        [round(float(p[0]), ROUND_DECIMALS), round(float(p[1]), ROUND_DECIMALS)]
        for p in raw_ring
        if valid_point(p)
    ]
    if len(pts) < 3:
        return None

    dedup = [pts[0]]
    for p in pts[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if len(dedup) < 3:
        return None

    if dedup[0] == dedup[-1]:
        dedup = dedup[:-1]
    if len(dedup) < 3:
        return None

    simplified = douglas_peucker(dedup + [dedup[0]], TOLERANCE_DEG)
    if simplified and simplified[0] == simplified[-1]:
        simplified = simplified[:-1]
    simplified = cap_points(simplified, MAX_RING_POINTS - 1)
    if len(simplified) < 3:
        return None
    simplified.append(simplified[0])
    return simplified


def sanitize_polygon(raw_polygon: Any) -> list[list[list[float]]] | None:
    if not isinstance(raw_polygon, list):
        return None
    rings = [r for r in (sanitize_ring(x) for x in raw_polygon) if r]
    return rings if rings else None


def sanitize_geometry(geom: Any) -> dict[str, Any] | None:
    if not isinstance(geom, dict):
        return None
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    if gtype == "Polygon":
        poly = sanitize_polygon(coords)
        return {"type": "Polygon", "coordinates": poly} if poly else None
    if gtype == "MultiPolygon" and isinstance(coords, list):
        polys = [p for p in (sanitize_polygon(x) for x in coords) if p]
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    # GeometryCollection vacía o tipos que no correspondan al catálogo poligonal
    # se descartan solamente en la copia web temporal.
    return None


def vertex_count(geom: Any) -> int:
    if not isinstance(geom, dict):
        return 0
    coords = geom.get("coordinates")
    gtype = geom.get("type")
    if gtype == "Polygon":
        return sum(len(r) for r in coords or [])
    if gtype == "MultiPolygon":
        return sum(len(r) for p in coords or [] for r in p)
    return 0


def process(path: Path, label: str) -> None:
    src_bytes = path.read_bytes()
    doc = json.loads(src_bytes.decode("utf-8"))
    features = doc.get("features", []) if isinstance(doc, dict) else []
    if not isinstance(features, list):
        raise RuntimeError(f"{label}: GeoJSON sin lista features")

    before_vertices = 0
    after_vertices = 0
    kept = []
    dropped = 0
    for feature in features:
        if not isinstance(feature, dict):
            dropped += 1
            continue
        before_vertices += vertex_count(feature.get("geometry"))
        geom = sanitize_geometry(feature.get("geometry"))
        if geom is None:
            dropped += 1
            continue
        after_vertices += vertex_count(geom)
        kept.append({
            "type": "Feature",
            "properties": feature.get("properties") if isinstance(feature.get("properties"), dict) else {},
            "geometry": geom,
        })

    if not kept:
        raise RuntimeError(f"{label}: saneamiento dejó 0 entidades; se aborta publicación")

    out = {"type": "FeatureCollection", "features": kept}
    encoded = json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(encoded)
    print(
        f"{label}: features {len(features)} -> {len(kept)}; "
        f"vertices {before_vertices} -> {after_vertices}; "
        f"bytes {len(src_bytes)} -> {len(encoded)}; descartadas={dropped}"
    )


if __name__ == "__main__":
    for label, path in SAFE_LAYERS.items():
        if not path.exists():
            print(f"{label}: archivo no presente, se omite: {path}")
            continue
        process(path, label)
