from __future__ import annotations
import json
from pathlib import Path
from shapely import make_valid, union_all
from shapely.geometry import shape, mapping

# Derivatives only: preserve every record and its attributes.
SAFE_LAYERS = {
    "Área Verde": Path("public/data/ambiental/amb-pol-areas-verdes.geojson"),
    "Área Verde PRC": Path("public/data/ambiental/amb-pol-averde-prc.geojson"),
    "Mascotas MZ 2026": Path("public/data/ambiental/amb-pol-mascotas-mz-2026.geojson"),
    "Plazas 2026": Path("public/data/ambiental/amb-pol-plazas-2026.geojson"),
    "Reciclaje por manzana": Path("public/data/ambiental/amb-pol-reciclaje-manzana.geojson"),
    "Reciclaje VF": Path("public/data/ambiental/amb-pol-reciclaje-vf.geojson"),
}
TOLERANCE_DEG = 0.000008
MAX_AREA_CHANGE = 0.01

def polygon_parts(geometry):
    if geometry.geom_type == "Polygon":
        return [geometry] if not geometry.is_empty else []
    if geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [part for child in geometry.geoms for part in polygon_parts(child)]
    return []

def web_geometry(raw):
    original=shape(raw)
    if not original.is_valid:
        original=make_valid(original)
    parts=polygon_parts(original)
    if not parts:
        raise ValueError("Entidad sin componente poligonal publicable")
    base=parts[0] if len(parts)==1 else union_all(parts)
    if not base.is_valid:
        base=make_valid(base)
        parts=polygon_parts(base)
        base=parts[0] if len(parts)==1 else union_all(parts)
    if base.is_empty or not base.is_valid or base.geom_type not in ("Polygon","MultiPolygon"):
        raise ValueError("No se obtuvo un polígono válido")
    minx,miny,maxx,maxy=base.bounds
    if not (-180<=minx<=maxx<=180 and -90<=miny<=maxy<=90):
        raise ValueError("Coordenadas fuera de EPSG:4326")
    simplified=base.simplify(TOLERANCE_DEG,preserve_topology=True)
    # Small/narrow shapes retain original coordinates instead of collapsing.
    # Avoid rounding/capping vertices: those operations introduced intersections.
    if (simplified.is_empty or not simplified.is_valid or
        simplified.geom_type not in ("Polygon","MultiPolygon") or
        (base.area and abs(simplified.area-base.area)/base.area>MAX_AREA_CHANGE)):
        simplified=base
    return mapping(simplified), original.geom_type=="GeometryCollection"

def vertex_count(g):
    if isinstance(g,(tuple,list)):
        if len(g)>=2 and isinstance(g[0],(int,float)): return 1
        return sum(vertex_count(x) for x in g)
    return 0

def process(path,label):
    doc=json.loads(path.read_text(encoding="utf-8-sig"))
    features=doc.get("features")
    if not isinstance(features,list) or not features:
        raise RuntimeError(label+": falta la lista de entidades")
    before_vertices=after_vertices=collections=0
    out=[]
    for i,feature in enumerate(features):
        try:
            geometry,compound=web_geometry(feature["geometry"])
        except Exception as exc:
            raise RuntimeError(f"{label}: entidad {i} no publicable; se detiene para evitar pérdida") from exc
        before_vertices+=vertex_count(feature["geometry"].get("coordinates",[]))
        after_vertices+=vertex_count(geometry["coordinates"])
        collections+=compound
        clean={**feature,"type":"Feature","geometry":geometry}
        out.append(clean)
    if len(out)!=len(features): raise RuntimeError("Pérdida de entidades")
    encoded=json.dumps({"type":"FeatureCollection","features":out},ensure_ascii=False,separators=(",",":"))
    path.write_text(encoded,encoding="utf-8")
    print(f"{label}: {len(features)} registros conservados; {collections} geometrías compuestas normalizadas; vértices {before_vertices}->{after_vertices}; bytes {len(encoded.encode('utf-8'))}")

if __name__=="__main__":
    for label,path in SAFE_LAYERS.items():
        if not path.exists(): raise FileNotFoundError(path)
        process(path,label)
