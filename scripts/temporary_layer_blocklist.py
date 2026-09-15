from pathlib import Path
import re

p = Path("app/page.tsx")
s = p.read_text(encoding="utf-8")

# Coberturas pesadas temporalmente inhabilitadas mientras se generan
# versiones web livianas para visualización segura.
# NDVI se administra por archivo concreto; no se bloquea genéricamente por año.
blocked = [
    "vf-amb-pol-areas-verdes",
    "vf-amb-pol-averde-prc",
    "vf-amb-pol-mascotas-mz-2026",
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

# Protección adicional vigente: Propiedades Municipales polígono.
helper = 'const temporarilyDisabled=(id:string)=>TEMPORARILY_DISABLED.has(id)||(/propiedad(?:es)?-municipal(?:es)?/i.test(id)&&/(?:^|-)pol(?:-|$)/i.test(id));'
s, n2 = re.subn(
    r'const temporarilyDisabled=\(id:string\)=>[^;]+;',
    helper,
    s,
    count=1,
)
if n2 != 1:
    raise RuntimeError("No se encontró temporarilyDisabled en app/page.tsx")

p.write_text(s, encoding="utf-8")
print("Bloqueo temporal aplicado: coberturas pesadas pendientes + Propiedades Municipales polígono.")
