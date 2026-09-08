from pathlib import Path
import re

p = Path("app/page.tsx")
s = p.read_text(encoding="utf-8")

blocked = [
    "vf-amb-pol-areas-verdes",
    "vf-amb-pol-averde-prc",
    "vf-amb-pol-mascotas-mz-2026",
    "vf-amb-pol-ndvi-stgo-oct-2025",
    "vf-amb-pol-ndwi-stgo-2025",
    "vf-amb-pol-plazas-2026",
    "vf-amb-pol-reciclaje-manzana",
    "vf-amb-pol-reciclaje-vf",
]

set_expr = "const TEMPORARILY_DISABLED=new Set<string>([" + ",".join(f'\"{x}\"' for x in blocked) + "]);"
s, n1 = re.subn(
    r'const TEMPORARILY_DISABLED=new Set<string>\(\[[^\]]*\]\);',
    set_expr,
    s,
    count=1,
)
if n1 != 1:
    raise RuntimeError("No se encontró TEMPORARILY_DISABLED en app/page.tsx")

# Además de las 8 coberturas, todo NDVI 2023/2025 queda temporalmente fuera de uso.
# También se bloquea exclusivamente la versión POLÍGONO de Propiedades Municipales,
# manteniendo disponible la cobertura de puntos hasta completar/validar todos los predios.
helper = 'const temporarilyDisabled=(id:string)=>TEMPORARILY_DISABLED.has(id)||(/ndvi/i.test(id)&&/(2023|2025)/.test(id))||(/propiedad(?:es)?-municipal(?:es)?/i.test(id)&&/(?:^|-)pol(?:-|$)/i.test(id));'
s, n2 = re.subn(
    r'const temporarilyDisabled=\(id:string\)=>[^;]+;',
    helper,
    s,
    count=1,
)
if n2 != 1:
    raise RuntimeError("No se encontró temporarilyDisabled en app/page.tsx")

p.write_text(s, encoding="utf-8")
print("Bloqueo temporal aplicado: 8 coberturas originales + NDVI 2023/2025 + Propiedades Municipales polígono.")
