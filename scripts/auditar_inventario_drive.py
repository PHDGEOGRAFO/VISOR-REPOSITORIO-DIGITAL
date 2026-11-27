"""Read-only inventory audit. Never writes Drive or publishes source data."""
import io
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict, deque
from pathlib import Path

import requests
from openpyxl import load_workbook

API = "https://www.googleapis.com/drive/v3"
FOLDER = "application/vnd.google-apps.folder"
EXT = {".shp", ".gpkg", ".zip", ".gdb", ".geojson", ".kml", ".kmz", ".tif", ".tiff", ".csv"}
TOKEN = os.environ.get("DRIVE_ACCESS_TOKEN", "")
ROOT = os.environ.get("BIBLIOTECA_ROOT_ID", "")
REGISTER = os.environ.get("BIBLIOTECA_CONTROL_FILE_ID", "")

def normalized(value):
    return re.sub(r"[^A-Z0-9]+", "_", unicodedata.normalize("NFD", str(value)).encode("ascii", "ignore").decode().upper()).strip("_")

def get(session, endpoint, **params):
    response = session.get(API + endpoint, params=params, timeout=90)
    if not response.ok:
        raise RuntimeError(f"Drive API HTTP {response.status_code}")
    return response

def scan(session, root):
    root_meta = get(session, "/files/" + root, fields="id,mimeType,trashed,driveId", supportsAllDrives="true").json()
    if root_meta.get("trashed") or root_meta.get("mimeType") != FOLDER:
        raise RuntimeError("Raíz no disponible o no es carpeta.")
    queue = deque([root])
    visited = set()
    items = {}
    while queue:
        parent = queue.popleft()
        if parent in visited:
            continue
        visited.add(parent)
        params = dict(q=f"'{parent}' in parents and trashed = false", fields="nextPageToken,incompleteSearch,files(id,name,mimeType,parents,modifiedTime,version,md5Checksum,size)", pageSize=1000, supportsAllDrives="true", includeItemsFromAllDrives="true")
        if root_meta.get("driveId"):
            params.update(corpora="drive", driveId=root_meta["driveId"])
        while True:
            page = get(session, "/files", **params).json()
            if page.get("incompleteSearch"):
                raise RuntimeError("Inventario incompleto. No se infieren bajas.")
            for item in page.get("files", []):
                items[item["id"]] = item
                if item.get("mimeType") == FOLDER:
                    queue.append(item["id"])
            token = page.get("nextPageToken")
            if not token:
                break
            params["pageToken"] = token
    return items, len(visited)

def audit(session):
    response = get(session, "/files/" + REGISTER + "/export", mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    wb = load_workbook(io.BytesIO(response.content), read_only=True, data_only=True)
    try:
        rows = iter(wb["Registro Maestro"].values)
        headers = next(rows)
        required = {"ID correlativo", "Nombre de cobertura", "ID DRIVE", "ID visor"}
        if not required.issubset(headers):
            raise RuntimeError("Columnas requeridas ausentes.")
        master = [dict(zip(headers, row)) for row in rows if row[0] is not None and row[1]]
    finally:
        wb.close()
    if not master or len({str(row["ID correlativo"]) for row in master}) != len(master):
        raise RuntimeError("Registro vacío o identificadores duplicados.")
    inventory, folders = scan(session, ROOT)
    candidates = {k:v for k,v in inventory.items() if Path(v.get("name","")).suffix.lower() in EXT}
    by_name = defaultdict(list)
    for item in candidates.values():
        by_name[normalized(Path(item["name"]).stem)].append(item["id"])
    counts = Counter()
    linked = set()
    for row in master:
        drive_id = str(row.get("ID DRIVE") or "").strip()
        name = normalized(row["Nombre de cobertura"])
        if drive_id:
            linked.add(drive_id)
            item = inventory.get(drive_id)
            if not item:
                counts["Vínculo no visible: revisar acceso, traslado o baja"] += 1
            else:
                counts["Vínculo físico visible"] += 1
                if normalized(Path(item["name"]).stem) != name:
                    counts["Nombre distinto: revisar renombre o alias"] += 1
        else:
            matches = by_name.get(name, [])
            counts["Sin ID: candidato único por nombre" if len(matches)==1 else "Sin ID: candidatos múltiples" if matches else "Sin ID: sin coincidencia exacta"] += 1
    counts["Archivos GIS candidatos sin vínculo explícito"] = len(set(candidates) - linked)
    lines = ["### Auditoría de inventario GIS STGO (solo lectura)", "", f"- Registros maestros: {len(master)}", f"- Carpetas recorridas: {folders}", f"- Elementos visibles: {len(inventory)}", f"- Archivos candidatos GIS: {len(candidates)}"]
    lines += [f"- {label}: {number}" for label, number in sorted(counts.items())]
    lines += ["", "Los candidatos no equivalen a coberturas nuevas. Los GPKG, ZIP y GDB pueden contener varias capas.", "Una ausencia no confirma una baja: podrían existir permisos insuficientes.", "No se almacenan nombres, IDs, rutas ni datos municipales en GitHub. No se modifica el registro ni los visores."]
    return "\n".join(lines)+"\n"

if __name__ == "__main__":
    if not (TOKEN and ROOT and REGISTER):
        sys.exit("Configuración pendiente: token temporal, carpeta raíz y registro.")
    try:
        with requests.Session() as session:
            session.headers["Authorization"] = "Bearer " + TOKEN
            report = audit(session)
        print(report)
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as handle:
            handle.write(report)
    except Exception as exc:
        # Do not expose raw API responses, paths, credentials or names in public logs.
        sys.exit("Auditoría interrumpida: " + type(exc).__name__ + ". Revisar permisos/configuración; no se infieren bajas.")
