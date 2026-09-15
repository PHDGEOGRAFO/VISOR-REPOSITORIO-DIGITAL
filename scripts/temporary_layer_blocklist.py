from pathlib import Path
import re

p = Path("app/page.tsx")
s = p.read_text(encoding="utf-8")

# Las coberturas antes inhabilitadas vuelven a estar disponibles.
# El motor de render V3 aplicado previamente por runtime_deploy_patches.py
# limita cantidad de polígonos, vértices y detalle para evitar bloquear la página.
blocked = []

set_expr = "const TEMPORARILY_DISABLED=new Set<string>([" + ",".join(f'\"{x}\"' for x in blocked) + "]);"
s, n1 = re.subn(
    r'const TEMPORARILY_DISABLED=new Set<string>\(\[[^\]]*\]\);',
    set_expr,
    s,
    count=1,
)
if n1 != 1:
    raise RuntimeError("No se encontró TEMPORARILY_DISABLED en app/page.tsx")

# Sin bloqueos por ID, NDVI o Propiedades Municipales: todas las coberturas
# quedan seleccionables; la protección se hace en el render, no ocultando datos.
helper = 'const temporarilyDisabled=(id:string)=>false;'
s, n2 = re.subn(
    r'const temporarilyDisabled=\(id:string\)=>[^;]+;',
    helper,
    s,
    count=1,
)
if n2 != 1:
    raise RuntimeError("No se encontró temporarilyDisabled en app/page.tsx")

p.write_text(s, encoding="utf-8")
print("Coberturas pesadas re-habilitadas: protección mediante render V3, sin bloqueos temporales.")
