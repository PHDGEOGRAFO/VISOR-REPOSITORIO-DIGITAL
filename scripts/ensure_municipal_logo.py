from pathlib import Path
import re

page = Path("app/page.tsx")
s = page.read_text(encoding="utf-8")

# En GitHub Pages usamos rutas relativas para no depender del basePath.
# Así funciona tanto en /VISOR-REPOSITORIO-DIGITAL/ como en una eventual ruta pública distinta.
logo = '<span className="municipalLogoBox"><img src="logo-munistgo.png" onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src="logo-munistgo-fallback.svg"}} alt="STGO Ilustre Municipalidad de Santiago"/></span>'
logo_print = '<span className="municipalLogoBox printLogoBox"><img src="logo-munistgo.png" onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src="logo-munistgo-fallback.svg"}} alt="Municipalidad de Santiago"/></span>'

# Reemplaza variantes antiguas o ya parcheadas del logo principal.
s, n1 = re.subn(
    r'<span className="municipalLogoBox"><img src=\{?`?\$\{?BASE_PATH\}?/?logo-munistgo\.png`?\}?[^>]*alt="STGO Ilustre Municipalidad de Santiago"/></span>',
    logo,
    s,
    count=1,
)
if n1 == 0:
    s, n1 = re.subn(
        r'<img src=\{?`?\$\{?BASE_PATH\}?/?logo-munistgo\.png`?\}?[^>]*alt="STGO Ilustre Municipalidad de Santiago"/>',
        logo,
        s,
        count=1,
    )
if n1 == 0 and 'src="logo-munistgo.png"' not in s:
    raise RuntimeError("No se encontró el logo municipal principal para corregir")

# Reemplaza variante de impresión si existe.
s, _ = re.subn(
    r'<span className="municipalLogoBox printLogoBox"><img src=\{?`?\$\{?BASE_PATH\}?/?logo-munistgo\.png`?\}?[^>]*alt="Municipalidad de Santiago"/></span>',
    logo_print,
    s,
    count=1,
)
s, _ = re.subn(
    r'<img src=\{?`?\$\{?BASE_PATH\}?/?logo-munistgo\.png`?\}?[^>]*alt="Municipalidad de Santiago"/>',
    logo_print,
    s,
    count=1,
)

page.write_text(s, encoding="utf-8")

css = Path("app/globals.css")
c = css.read_text(encoding="utf-8")
marker = "/* MUNICIPAL_LOGO_VISIBLE */"
if marker not in c:
    c += '''\n/* MUNICIPAL_LOGO_VISIBLE */\n.municipalLogoBox{display:flex;align-items:center;justify-content:flex-start;background:#fff;border-radius:4px;padding:4px 7px;min-width:145px;height:54px;box-shadow:0 0 0 1px #ffffff55;flex:0 0 auto}\n.municipalLogoBox img{display:block!important;width:132px!important;max-width:132px!important;height:44px!important;object-fit:contain!important;object-position:left center!important;opacity:1!important;visibility:visible!important}\n.printLogoBox{min-width:128px;height:48px;padding:3px 6px}\n.printLogoBox img{width:116px!important;max-width:116px!important;height:38px!important}\n@media(max-width:1366px){.municipalLogoBox{min-width:120px;height:48px;padding:3px 6px}.municipalLogoBox img{width:108px!important;max-width:108px!important;height:40px!important}}\n'''
css.write_text(c, encoding="utf-8")
print("Logo municipal corregido con ruta relativa y fallback SVG.")
