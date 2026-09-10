from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "app" / "page.tsx"
CATALOG = ROOT / "public" / "catalog" / "index_coberturas.json"
OUT = ROOT / "public" / "data" / "sociocultural" / "tur-pto-airbnb-stgo-2026.geojson"
URL = "https://data.insideairbnb.com/chile/rm/santiago/2026-06-29/data/listings.csv.gz"
LAYER_ID = "vf-tur-pto-airbnb-stgo-2026"

NAME_MAP = {
    "JUDICIAL": "Rondizzoni",
    "UNIVERSITARIO": "República",
    "PARQUE O'HIGGINS": "Parque O’Higgins",
}


def read_limits():
    barrios = gpd.read_file(ROOT / "public" / "data" / "barrios.geojson")
    territorios = gpd.read_file(ROOT / "public" / "data" / "urbana" / "limite-territorios-pladeco.geojson")

    bfield = next((c for c in ["BARRIO", "NOM_BARRIO", "NOMBRE"] if c in barrios.columns), None)
    if not bfield:
        raise RuntimeError("No se encontró campo de barrio en barrios.geojson")
    barrios["BARRIO_VISOR"] = barrios[bfield].astype(str).str.strip()
    barrios["BARRIO_VISOR"] = barrios["BARRIO_VISOR"].replace(NAME_MAP)
    barrios = barrios[["BARRIO_VISOR", "geometry"]].dissolve(by="BARRIO_VISOR", as_index=False)

    tfield = next((c for c in ["SECTORES_T", "NOM_TERR", "TERRITORIO", "NOMBRE"] if c in territorios.columns), None)
    if not tfield:
        raise RuntimeError("No se encontró campo de territorio")
    territorios["TERRITORIO_VISOR"] = territorios[tfield].astype(str).str.strip().str.title()
    territorios = territorios[["TERRITORIO_VISOR", "geometry"]]
    return barrios.to_crs(4326), territorios.to_crs(4326)


def build_geojson():
    df = pd.read_csv(URL, compression="gzip", low_memory=False)
    df = df[df["neighbourhood_cleansed"].astype(str).str.strip().str.casefold() == "santiago"].copy()
    df = df[df["latitude"].notna() & df["longitude"].notna()].copy()

    gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["longitude"], df["latitude"]),
        crs=4326,
    )
    barrios, territorios = read_limits()
    gdf = gpd.sjoin(gdf, barrios, how="left", predicate="intersects").drop(columns=["index_right"], errors="ignore")
    gdf = gpd.sjoin(gdf, territorios, how="left", predicate="intersects").drop(columns=["index_right"], errors="ignore")
    gdf = gdf.sort_values("id").drop_duplicates("id")

    def price(v):
        if pd.isna(v):
            return None
        try:
            return float(str(v).replace("$", "").replace(",", "").strip())
        except Exception:
            return None

    out = gdf[["id", "BARRIO_VISOR", "TERRITORIO_VISOR", "room_type", "price", "number_of_reviews", "geometry"]].copy()
    out = out.rename(columns={
        "id": "listing_id",
        "BARRIO_VISOR": "BARRIO",
        "TERRITORIO_VISOR": "TERRITORIO",
        "room_type": "tipo_habitacion",
        "number_of_reviews": "n_resenas",
    })
    out["precio_clp"] = out["price"].map(price)
    out = out.drop(columns=["price"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_file(OUT, driver="GeoJSON")
    data = json.loads(OUT.read_text(encoding="utf-8"))
    for f in data.get("features", []):
        if f.get("geometry", {}).get("type") == "Point":
            x, y = f["geometry"]["coordinates"][:2]
            f["geometry"]["coordinates"] = [round(x, 6), round(y, 6)]
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(out), int(out["BARRIO"].isna().sum()), int(out["TERRITORIO"].isna().sum())


def update_page():
    txt = PAGE.read_text(encoding="utf-8")
    layer_line = ' {id:"vf-tur-pto-airbnb-stgo-2026",name:"Airbnb 2026",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/sociocultural/tur-pto-airbnb-stgo-2026.geojson`,color:"#6f7f3f",description:"Airbnb Santiago 2026 · corte 29 de junio de 2026. Cobertura territorial con barrio y territorio municipal.",source:"TUR_GIS_AIRBNB / AIRBNB_2026"},\n'
    style_line = ' "vf-tur-pto-airbnb-stgo-2026":{color:"#6f7f3f",pointRadius:4},\n'

    if LAYER_ID not in txt:
        anchor = ' {id:"vf-tur-pto-atractivos-sernatur-vfago26"'
        pos = txt.find(anchor)
        if pos == -1:
            raise RuntimeError("No se encontró ancla de capas TUR en page.tsx")
        txt = txt[:pos] + layer_line + txt[pos:]

    if style_line.strip() not in txt:
        anchor = ' "vf-soc-pol-rsh-40-2024"'
        pos = txt.find(anchor)
        if pos == -1:
            raise RuntimeError("No se encontró ancla de estilos SOC en page.tsx")
        txt = txt[:pos] + style_line + txt[pos:]

    PAGE.write_text(txt, encoding="utf-8")


def update_catalog(n):
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    items = data.get("items", [])
    item = {
        "id": LAYER_ID,
        "mapId": LAYER_ID,
        "tema": "TUR",
        "dimensionPladeco": "DIMENSIÓN SOCIOCULTURAL",
        "sector": "Turismo",
        "nombre": "Airbnb 2026",
        "carpeta": "TUR_GIS_AIRBNB/AIRBNB_2026",
        "geometria": "Punto",
        "escala": "Comuna / Barrio / Territorio",
        "contenedor": "TUR_PTO_AIRBNB_STGO_2026.gpkg",
        "tipoContenedor": "GeoPackage fuente / GeoJSON público",
        "subcapa": "TUR_PTO_AIRBNB_STGO_2026",
        "campoClave": "listing_id",
        "estado": "PUBLICADA",
        "validacion": "VALIDADA PARA VISUALIZACIÓN",
        "registros": n,
        "registrosFuente": n,
        "crs": "EPSG:4326 (web)",
        "anio": 2026,
        "verEnMapa": True,
        "download": "/data/sociocultural/tur-pto-airbnb-stgo-2026.geojson",
        "observaciones": "Fuente Inside Airbnb, corte 29-06-2026. Filtrado a comuna de Santiago y asociado a barrios/territorios municipales.",
    }
    items = [x for x in items if x.get("id") != LAYER_ID]
    # Insertar junto a otras capas TUR si es posible.
    idx = next((i for i, x in enumerate(items) if str(x.get("id", "")).startswith("vf-tur-")), len(items))
    items.insert(idx, item)
    data["items"] = items
    data["total"] = len(items)
    data["generatedAt"] = "2026-09-10"
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    n, sin_barrio, sin_territorio = build_geojson()
    if n != 7182:
        raise RuntimeError(f"Se esperaban 7182 anuncios de Santiago y se obtuvieron {n}")
    if sin_barrio or sin_territorio:
        raise RuntimeError(f"Cruce incompleto: sin barrio={sin_barrio}, sin territorio={sin_territorio}")
    update_page()
    update_catalog(n)
    print(f"Airbnb 2026 incorporado: {n} registros; sin barrio={sin_barrio}; sin territorio={sin_territorio}")


if __name__ == "__main__":
    main()
