"""Build private reconciliation proposals and an initial physical baseline in Sheets.
Never changes the master, source files, publication, or public logs with identifiers.
"""
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests
from auditar_inventario_drive import scan, normalized, EXT, ROOT, REGISTER, TOKEN

SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/" + REGISTER
RECON = "Conciliación automática"
BASE = "Línea base física"
RH = ["ID correlativo","Nombre maestro","Formato maestro","ID actual","Estado propuesta","ID candidato único","Nombre físico candidato","ID carpeta","Fecha modificación","Cantidad candidatos","Criterio","Fecha auditoría"]
BH = ["ID DRIVE","Nombre físico","Tipo MIME","ID carpeta","Fecha modificación","Versión","Checksum MD5","Tamaño bytes","Fecha captura"]

def request(session, method, url, **kwargs):
    r = session.request(method, url, timeout=120, **kwargs)
    if not r.ok:
        raise RuntimeError("Sheets HTTP " + str(r.status_code))
    return r.json()

def values(session, name, address):
    from urllib.parse import quote
    return request(session, "GET", SHEETS + "/values/" + quote("'" + name + "'!" + address, safe=""), params={"valueRenderOption":"UNFORMATTED_VALUE"}).get("values", [])

def proposals(master, inventory, stamp):
    headers = master[0]
    required = {"ID correlativo","Nombre de cobertura","Formato","ID DRIVE"}
    if not required.issubset(headers):
        raise ValueError("Invalid master schema")
    rows = [dict(zip(headers,r)) for r in master[1:] if len(r)>1 and r[0] and r[1]]
    if not rows or len({str(r["ID correlativo"]) for r in rows}) != len(rows):
        raise ValueError("Empty or duplicate master")
    candidates = {k:v for k,v in inventory.items() if Path(v.get("name","")).suffix.lower() in EXT}
    by_name = defaultdict(list)
    claimed = Counter(str(r.get("ID DRIVE") or "").strip() for r in rows)
    missing_names = Counter(normalized(r["Nombre de cobertura"]) for r in rows if not r.get("ID DRIVE"))
    for item in candidates.values():
        by_name[normalized(Path(item["name"]).stem)].append(item)
    out = [RH]
    counts = Counter()
    for row in rows:
        name = row["Nombre de cobertura"]
        key = str(row.get("ID DRIVE") or "").strip()
        fmt = str(row.get("Formato") or "")
        matches = by_name.get(normalized(name), [])
        item = None
        if key:
            item = inventory.get(key)
            state = "VÍNCULO VISIBLE" if item else "VÍNCULO NO VISIBLE"
            criterion = "ID físico existente; no se valida contenido"
            if item and normalized(Path(item["name"]).stem) != normalized(name):
                state = "REVISAR NOMBRE O ALIAS"
        elif len(matches)==1:
            item = matches[0]
            ext = Path(item["name"]).suffix.lower()
            expected = {"SHP":".shp","GPKG":".gpkg","GDB":".gdb"}.get(fmt.strip().upper())
            if claimed[item["id"]] or missing_names[normalized(name)]>1:
                state = "REVISAR VÍNCULO COMPARTIDO"
            elif expected == ext and ext == ".shp":
                state = "CANDIDATO PRIORITARIO"
            else:
                state = "REVISAR FORMATO O SUBCAPAS"
            criterion = "Nombre normalizado único; requiere aprobación"
        else:
            state = "MÚLTIPLES CANDIDATOS" if matches else "SIN COINCIDENCIA"
            criterion = "No asignar ID automáticamente"
        counts[state]+=1
        item = item or {}
        out.append([str(row["ID correlativo"]),name,fmt,key,state,item.get("id",""),item.get("name",""),";".join(item.get("parents",[])),item.get("modifiedTime",""),len(matches),criterion,stamp])
    baseline = [BH]
    for item in sorted(candidates.values(), key=lambda x:x["id"]):
        baseline.append([item["id"],item["name"],item.get("mimeType",""),";".join(item.get("parents",[])),item.get("modifiedTime",""),item.get("version",""),item.get("md5Checksum",""),item.get("size",""),stamp])
    return out, baseline, counts

def cell(value):
    return {"userEnteredValue":{"numberValue":value} if isinstance(value,int) else {"stringValue":str(value or "")}}

def write_request(props, rows):
    # Update only automated sheets. Clear stale rows in the same atomic request.
    width=len(rows[0])
    grid=props["gridProperties"]
    if grid["columnCount"]<width or grid["rowCount"]<len(rows):
        raise ValueError("Insufficient automated sheet dimensions")
    return {"updateCells":{"range":{"sheetId":props["sheetId"],"startRowIndex":0,"endRowIndex":grid["rowCount"],"startColumnIndex":0,"endColumnIndex":width},"rows":[{"values":[cell(v) for v in row]} for row in rows],"fields":"userEnteredValue"}}

def run(session):
    meta=request(session,"GET",SHEETS,params={"fields":"sheets(properties(sheetId,title,gridProperties)" + ")"})
    tabs={s["properties"]["title"]:s["properties"] for s in meta["sheets"]}
    master=values(session,"Registro Maestro","A1:T"+str(tabs["Registro Maestro"]["gridProperties"]["rowCount"]))
    oldbase=values(session,BASE,"A1:A2")
    inventory, folders=scan(session,ROOT)
    stamp=datetime.now(timezone.utc).isoformat()
    recon, base, counts=proposals(master,inventory,stamp)
    if len(base)<2:
        raise ValueError("Empty physical baseline")
    if values(session,"Registro Maestro","A1:T"+str(tabs["Registro Maestro"]["gridProperties"]["rowCount"]))!=master:
        raise RuntimeError("Master changed during scan")
    req=[write_request(tabs[RECON],recon)]
    # Freeze the first successful baseline. Never overwrite on subsequent runs.
    if not (len(oldbase)>1 and oldbase[1] and oldbase[1][0]):
        req.append(write_request(tabs[BASE],base))
    request(session,"POST",SHEETS+":batchUpdate",json={"requests":req})
    if len(values(session,RECON,"A1:A"+str(len(recon))))!=len(recon):
        raise RuntimeError("Readback mismatch")
    return ["Conciliación privada registrada: "+str(len(recon)-1),"Archivos candidatos observados: "+str(len(base)-1),"Carpetas recorridas: "+str(folders),"Línea base inicial creada." if len(req)==2 else "Línea base previa conservada."]+[f"{k}: {v}" for k,v in sorted(counts.items())]

if __name__=="__main__":
    if not (TOKEN and ROOT and REGISTER):
        sys.exit("Configuración pendiente.")
    try:
        with requests.Session() as session:
            session.headers["Authorization"]="Bearer "+TOKEN
            report=run(session)
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write("### Conciliación privada\n"+"\n".join("- "+x for x in report)+"\n")
        print("\n".join(report))
    except Exception as exc:
        sys.exit("Conciliación interrumpida: "+type(exc).__name__+". Revisar API, permisos y capacidad de pestañas.")
