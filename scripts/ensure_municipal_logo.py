from pathlib import Path
import re

page = Path("app/page.tsx")
s = page.read_text(encoding="utf-8")

# SVG autónomo: no depende de PNG, rutas ni archivos externos.
logo_svg = '''<span className="municipalLogoBox" aria-label="STGO Ilustre Municipalidad de Santiago"><svg className="municipalInlineLogo" viewBox="0 0 360 110" role="img" aria-label="STGO Ilustre Municipalidad de Santiago"><rect x="0" y="0" width="360" height="110" rx="5" fill="white"/><text x="14" y="35" fontSize="28" fontWeight="700" fill="#0a3f82">STGO</text><text x="98" y="35" fontSize="19" fontWeight="600" fill="#0a3f82">Ilustre</text><text x="14" y="67" fontSize="20" fill="#0a3f82">Municipalidad de</text><text x="14" y="94" fontSize="22" fontWeight="600" fill="#0a3f82">Santiago</text></svg></span>'''
logo_print = '''<span className="municipalLogoBox printLogoBox" aria-label="Municipalidad de Santiago"><svg className="municipalInlineLogo" viewBox="0 0 360 110" role="img" aria-label="Municipalidad de Santiago"><rect x="0" y="0" width="360" height="110" rx="5" fill="white"/><text x="14" y="35" fontSize="28" fontWeight="700" fill="#0a3f82">STGO</text><text x="98" y="35" fontSize="19" fontWeight="600" fill="#0a3f82">Ilustre</text><text x="14" y="67" fontSize="20" fill="#0a3f82">Municipalidad de</text><text x="14" y="94" fontSize="22" fontWeight="600" fill="#0a3f82">Santiago</text></svg></span>'''

# Sustituye cualquier variante previa del logo por el SVG autónomo.
patterns = [
    r'<span className="municipalLogoBox">.*?alt="STGO Ilustre Municipalidad de Santiago".*?</span>',
    r'<img[^>]*alt="STGO Ilustre Municipalidad de Santiago"[^>]*/>',
]
replaced = False
for pat in patterns:
    s, n = re.subn(pat, logo_svg, s, count=1, flags=re.S)
    if n:
        replaced = True
        break
if not replaced and 'municipalInlineLogo' not in s:
    raise RuntimeError("No se encontró el logo municipal principal para reemplazar")

# Logo de impresión, si existe.
s = re.sub(r'<span className="municipalLogoBox printLogoBox">.*?alt="Municipalidad de Santiago".*?</span>', logo_print, s, count=1, flags=re.S)
s = re.sub(r'<img[^>]*alt="Municipalidad de Santiago"[^>]*/>', logo_print, s, count=1, flags=re.S)

page.write_text(s, encoding="utf-8")

css = Path("app/globals.css")
c = css.read_text(encoding="utf-8")
marker = "/* MUNICIPAL_LOGO_INLINE_SVG */"
if marker not in c:
    c += '''\n/* MUNICIPAL_LOGO_INLINE_SVG */\n.municipalLogoBox{display:flex;align-items:center;justify-content:flex-start;background:#fff;border-radius:4px;padding:3px 6px;min-width:145px;height:54px;flex:0 0 auto;overflow:hidden}\n.municipalInlineLogo{display:block;width:145px;height:48px;max-width:145px;flex:0 0 auto}\n.printLogoBox{min-width:128px;height:48px}\n.printLogoBox .municipalInlineLogo{width:128px;height:42px}\n@media(max-width:1366px){.municipalLogoBox{min-width:122px;height:48px}.municipalInlineLogo{width:122px;height:42px;max-width:122px}}\n'''
css.write_text(c, encoding="utf-8")
print("Logo municipal convertido a SVG autónomo embebido; sin dependencia de archivos externos.")
