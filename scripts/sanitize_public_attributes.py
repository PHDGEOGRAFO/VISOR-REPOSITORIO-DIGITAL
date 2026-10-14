from __future__ import annotations
import json
import re
import sqlite3
import subprocess
import tempfile
import unicodedata
from pathlib import Path

PERSONAL = ["rut","run","dni","email","correo","mail","telefono","fono","celular","contacto","responsable","encargado","propietario","titular","dueno","apellido","persona","beneficiario","contribuyente","representante","solicitante","paciente","alumno","vecino","nacimiento","fecha_nac","clave","password","contrasena"]
ADDRESSES = ["direccion","domicilio","calle","address","ubicacion","numeracion","nro_dom","numero_dom","dir_particular"]
FREE_TEXT = ["observacion","comentario","descripcion","detalle","nota","notes"]
PUBLIC_NAMES = ["barrio","territorio","comuna","sector","establecimiento","equipamiento","recinto","parque","plaza","biblioteca","institucion","organizacion","servicio","especie","escuela","colegio","centro"]
RUT = re.compile(r"^(?:\d{1,2}(?:\.\d{3}){2}|\d{7,8})-[\dkK]$")

def normalize(key):
    s = "".join(c for c in unicodedata.normalize("NFD",str(key).lower()) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+","_",s)

def sensitive_attribute(key):
    n = normalize(key)
    if any(v in n for v in PERSONAL + ADDRESSES + FREE_TEXT) or "dir" in n.split("_"):
        return True
    if re.search(r"(?:^|_)(?:nombre|nombres|name|names|nom)(?:_|$)",n):
        return not any(v in n for v in PUBLIC_NAMES)
    return False

def sanitize_properties(obj):
    if isinstance(obj,dict):
        return {k:sanitize_properties(v) for k,v in obj.items() if not sensitive_attribute(k)}
    if isinstance(obj,list):
        return [sanitize_properties(v) for v in obj]
    if isinstance(obj,str) and RUT.fullmatch(obj.strip()):
        return None
    return obj

def sanitize_geojson(path):
    doc=json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(doc,dict) or doc.get("type") not in ("FeatureCollection","Feature"):
        return
    features=doc.get("features",[]) if doc["type"]=="FeatureCollection" else [doc]
    for f in features:
        if not isinstance(f,dict): continue
        f["properties"]=sanitize_properties(f.get("properties") or {})
        if isinstance(f.get("id"),str) and RUT.fullmatch(f["id"].strip()): f.pop("id")
    path.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":")),encoding="utf-8")

def quote(name):
    return '"' + name.replace('"','""') + '"'

def sanitize_gpkg(path):
    with sqlite3.connect(path) as db:
        tables=db.execute("SELECT table_name FROM gpkg_contents WHERE data_type IN ('features','attributes')").fetchall()
        schema=[]
        for (name,) in tables:
            cols=[r[1] for r in db.execute("PRAGMA table_info("+quote(name)+")")]
            kept=[c for c in cols if not sensitive_attribute(c)]
            count=db.execute("SELECT COUNT(*) FROM "+quote(name)).fetchone()[0]
            schema.append((name,cols,kept,count))
    with tempfile.TemporaryDirectory() as folder:
        output=Path(folder)/"public.gpkg"
        for name,cols,kept,count in schema:
            if not kept: raise RuntimeError("No quedan campos publicables en "+name)
            sql="SELECT "+",".join(map(quote,kept))+" FROM "+quote(name)
            cmd=["ogr2ogr","-f","GPKG",str(output),str(path),"-sql",sql,"-nln",name]
            if output.exists(): cmd.extend(["-update"])
            subprocess.run(cmd,check=True,capture_output=True,text=True)
        with sqlite3.connect(output) as db:
            for name,cols,kept,count in schema:
                actual=db.execute("SELECT COUNT(*) FROM "+quote(name)).fetchone()[0]
                if actual!=count: raise RuntimeError("Cambió el número de registros: "+name)
                fields=[r[1] for r in db.execute("PRAGMA table_info("+quote(name)+")")]
                if any(sensitive_attribute(c) for c in fields):
                    raise RuntimeError("Campo sensible residual: "+name)
            # Replace RUT-formatted values even under unrelated text field names.
            for name,cols,kept,count in schema:
                fields=[r[1] for r in db.execute("PRAGMA table_info("+quote(name)+")") if "TEXT" in str(r[2]).upper()]
                for field in fields:
                    values=db.execute("SELECT DISTINCT "+quote(field)+" FROM "+quote(name)+" WHERE "+quote(field)+" LIKE '%-%'").fetchall()
                    for (value,) in values:
                        if isinstance(value,str) and RUT.fullmatch(value.strip()):
                            db.execute("UPDATE "+quote(name)+" SET "+quote(field)+"=NULL WHERE "+quote(field)+"=?",(value,))
            db.commit()
        path.write_bytes(output.read_bytes())
    print(path.name+": atributos personales omitidos; registros conservados")

def main():
    public=Path("public")
    paths=list(public.rglob("*.geojson"))
    paths.extend(public.rglob("*.json"))
    for path in paths: sanitize_geojson(path)
    for path in public.rglob("*.gpkg"):
        sanitize_gpkg(path)
    print("Privacidad aplicada a copias públicas GeoJSON y GeoPackage antes de generar Shapefile.")

if __name__=="__main__":
    main()
