import json
from pathlib import Path

p = Path("public/catalog/index_coberturas.json")
obj = json.loads(p.read_text(encoding="utf-8"))

changed = False
for item in obj.get("items", []):
    if item.get("id") == "vf-ins-ins-pol-riesgo-situacional-barrio-2026" or item.get("nombre") == "Riesgo Situacional Barrio 2026":
        item["tema"] = "SOC"
        item["dimensionPladeco"] = "DIMENSIÓN SOCIOCULTURAL"
        item["sector"] = "Seguridad"
        changed = True

if not changed:
    raise RuntimeError("No se encontro Riesgo Situacional Barrio 2026 en el catalogo")

p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("Riesgo Situacional Barrio 2026 reclasificado a DIMENSION SOCIOCULTURAL / Seguridad")
