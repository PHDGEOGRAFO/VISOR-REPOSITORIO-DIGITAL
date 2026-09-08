from pathlib import Path

page = Path("app/page.tsx")
s = page.read_text(encoding="utf-8")
old = '<img src={`${BASE_PATH}/logo-munistgo.png`} alt="STGO Ilustre Municipalidad de Santiago"/>'
new = '<span className="municipalLogoBox"><img src={`${BASE_PATH}/logo-munistgo.png`} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=`${BASE_PATH}/logo-munistgo-fallback.svg`}} alt="STGO Ilustre Municipalidad de Santiago"/></span>'
if old in s:
    s = s.replace(old, new, 1)
old_print = '<img src={`${BASE_PATH}/logo-munistgo.png`} alt="Municipalidad de Santiago"/>'
new_print = '<span className="municipalLogoBox printLogoBox"><img src={`${BASE_PATH}/logo-munistgo.png`} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=`${BASE_PATH}/logo-munistgo-fallback.svg`}} alt="Municipalidad de Santiago"/></span>'
if old_print in s:
    s = s.replace(old_print, new_print, 1)
page.write_text(s, encoding="utf-8")

css = Path("app/globals.css")
c = css.read_text(encoding="utf-8")
marker = "/* MUNICIPAL_LOGO_VISIBLE */"
if marker not in c:
    c += '''\n/* MUNICIPAL_LOGO_VISIBLE */\n.municipalLogoBox{display:flex;align-items:center;justify-content:flex-start;background:#fff;border-radius:4px;padding:4px 7px;min-width:145px;height:54px;box-shadow:0 0 0 1px #ffffff55;flex:0 0 auto}\n.municipalLogoBox img{display:block!important;width:132px!important;max-width:132px!important;height:44px!important;object-fit:contain!important;object-position:left center!important;opacity:1!important;visibility:visible!important}\n.printLogoBox{min-width:128px;height:48px;padding:3px 6px}\n.printLogoBox img{width:116px!important;max-width:116px!important;height:38px!important}\n@media(max-width:1366px){.municipalLogoBox{min-width:120px;height:48px;padding:3px 6px}.municipalLogoBox img{width:108px!important;max-width:108px!important;height:40px!important}}\n'''
css.write_text(c, encoding="utf-8")
