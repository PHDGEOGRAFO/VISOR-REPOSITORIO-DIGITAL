"""Private physical change tracking. No automatic publication or deletion."""
import sys
import os
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
import requests
from auditar_inventario_drive import scan, ROOT, REGISTER, TOKEN, API
from conciliar_inventario_drive import SHEETS, BH, RECON, proposals, request, values, write_request, cell

CURRENT = "Inventario vigente"
HISTORY = "Bitácora física"
HH = ["Fecha UTC","Tipo de cambio","ID DRIVE","Nombre anterior","Nombre actual","Carpeta anterior","Carpeta actual","Detalle","Estado revisión","ID evento"]

def indexed(rows):
    if not rows or rows[0] != BH:
        raise ValueError("Invalid inventory header")
    result = {}
    for row in rows[1:]:
        if not row or not row[0]:
            continue
        r = [str(x or "") for x in row] + [""] * (9-len(row))
        if r[0] in result:
            raise ValueError("Duplicate physical ID")
        r[3] = ";".join(sorted(r[3].split(";")))
        result[r[0]] = r
    return result

def events(old, new, stamp, absence):
    output = []
    def emit(kind, k, a, b, detail):
        identity = hashlib.sha256(json.dumps([stamp,kind,k,a[:8],b[:8]],ensure_ascii=False).encode()).hexdigest()
        output.append([stamp,kind,k,a[1],b[1],a[3],b[3],detail,"PENDIENTE",identity])
    blank = [""]*9
    for k in sorted(old.keys() | new.keys()):
        a,b = old.get(k),new.get(k)
        if a is None:
            emit("ALTA FÍSICA OBSERVADA",k,blank,b,"Archivo nuevo en inventario; no equivale a nueva cobertura")
        elif b is None:
            emit(absence.get(k,"NO VISIBLE"),k,a,blank,"No eliminar registro maestro automáticamente")
        else:
            if a[1]!=b[1]:
                emit("RENOMBRE FÍSICO",k,a,b,"Mismo ID Drive")
            if a[3]!=b[3]:
                emit("TRASLADO",k,a,b,"Cambio de carpeta contenedora")
            if a[6] and b[6] and a[6]!=b[6]:
                emit("CONTENIDO MODIFICADO",k,a,b,"Checksum MD5 distinto")
            elif a[7] and b[7] and a[7]!=b[7]:
                emit("TAMAÑO MODIFICADO",k,a,b,"Tamaño distinto; verificar contenido")
            elif (a[4],a[5])!=(b[4],b[5]) and not (a[6] and b[6] and a[6]==b[6]):
                emit("VERSIÓN O METADATOS",k,a,b,"No confirma modificación geométrica")
    return output

def classify_absence(session,k,inventory):
    if k in inventory:
        return "FUERA DE FORMATO CANDIDATO"
    response=session.get(API+"/files/"+k,params={"fields":"id,trashed,parents","supportsAllDrives":"true"},timeout=60)
    if response.status_code in (403,404):
        return "NO VISIBLE: ACCESO O BAJA"
    if not response.ok:
        raise RuntimeError("Drive verification failed")
    return "EN PAPELERA CONFIRMADO" if response.json().get("trashed") else "FUERA DEL INVENTARIO VISIBLE"

def selftest():
    def row(k,name="A.shp",parent="p",md5="x"):
        return [k,name,"binary",parent,"t","1",md5,"100","stamp"]
    old=indexed([BH,row("1"),row("2"),row("3"),row("5")])
    new=indexed([BH,row("1","B.shp","q","y"),row("3"),row("4")])
    e=events(old,new,"stamp2",{"2":"EN PAPELERA CONFIRMADO","5":"NO VISIBLE: ACCESO O BAJA"})
    assert Counter(x[1] for x in e)==Counter(["RENOMBRE FÍSICO","TRASLADO","CONTENIDO MODIFICADO","EN PAPELERA CONFIRMADO","NO VISIBLE: ACCESO O BAJA","ALTA FÍSICA OBSERVADA"])
    assert not events(new,new,"stamp3",{})
    assert len({x[-1] for x in e})==len(e)
    print("Pruebas sintéticas de cambios: OK")

def run(session):
    meta=request(session,"GET",SHEETS,params={"fields":"sheets(properties(sheetId,title,gridProperties))"})
    tabs={s["properties"]["title"]:s["properties"] for s in meta["sheets"]}
    def read(tab,end):
        return values(session,tab,"A1:"+end+str(tabs[tab]["gridProperties"]["rowCount"]))
    master=read("Registro Maestro","T")
    previous=read(CURRENT,"I")
    history=read(HISTORY,"J")
    if not history or history[0]!=HH:
        raise ValueError("Invalid history header")
    old=indexed(previous)
    inventory,folders=scan(session,ROOT)
    stamp=datetime.now(timezone.utc).isoformat()
    recon,snapshot,counts=proposals(master,inventory,stamp)
    new=indexed(snapshot)
    if not old or not new or len(new)<len(old)*0.8:
        raise ValueError("Inventory coverage dropped; review access before proceeding")
    absent={k:classify_absence(session,k,inventory) for k in old.keys()-new.keys()}
    changes=events(old,new,stamp,absent)
    if read("Registro Maestro","T")!=master or read(CURRENT,"I")!=previous or read(HISTORY,"J")!=history:
        raise RuntimeError("Concurrent sheet modification")
    req=[]
    for title,rows in [(CURRENT,snapshot),(RECON,recon)]:
        props=tabs[title]
        if len(rows)>props["gridProperties"]["rowCount"]:
            req.append({"appendDimension":{"sheetId":props["sheetId"],"dimension":"ROWS","length":len(rows)-props["gridProperties"]["rowCount"]+100}})
            props["gridProperties"]["rowCount"]=len(rows)+100
        req.append(write_request(props,rows))
    if changes:
        props=tabs[HISTORY]
        needed=len(history)+len(changes)
        if needed>props["gridProperties"]["rowCount"]:
            req.append({"appendDimension":{"sheetId":props["sheetId"],"dimension":"ROWS","length":needed-props["gridProperties"]["rowCount"]+100}})
        req.append({"updateCells":{"start":{"sheetId":props["sheetId"],"rowIndex":len(history),"columnIndex":0},"rows":[{"values":[cell(v) for v in row]} for row in changes],"fields":"userEnteredValue"}})
    request(session,"POST",SHEETS+":batchUpdate",json={"requests":req})
    if indexed(values(session,CURRENT,"A1:I"+str(len(snapshot))))!=new:
        raise RuntimeError("Inventory readback mismatch")
    if changes and len(values(session,HISTORY,"A1:J"+str(len(history)+len(changes))))!=len(history)+len(changes):
        raise RuntimeError("History readback mismatch")
    return ["Inventario vigente: "+str(len(new)),"Registros conciliados: "+str(len(recon)-1),"Carpetas recorridas: "+str(folders),"Eventos registrados: "+str(len(changes))]+[f"{k}: {v}" for k,v in sorted(Counter(x[1] for x in changes).items())]

if __name__=="__main__":
    if "--self-test" in sys.argv:
        selftest()
        sys.exit(0)
    if not (TOKEN and ROOT and REGISTER):
        sys.exit("Configuración pendiente")
    try:
        selftest()
        with requests.Session() as session:
            session.headers["Authorization"]="Bearer "+TOKEN
            report=run(session)
        text="\n".join(report)+"\n"
        print(text)
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write("### Seguimiento físico privado\n"+text)
    except Exception as exc:
        sys.exit("Seguimiento interrumpido: "+type(exc).__name__+". Revisar acceso e integridad; no se infieren bajas.")
