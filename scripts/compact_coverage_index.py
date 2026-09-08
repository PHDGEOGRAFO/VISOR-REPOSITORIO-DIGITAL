from pathlib import Path

# Ajuste KISS del Índice de Coberturas.
# Se ejecuta después de runtime_deploy_patches.py y temporary_layer_blocklist.py.

page = Path("app/page.tsx")
s = page.read_text(encoding="utf-8")

# 1) Columna MAPA: solo checkbox, sin texto Activa/Activar.
old = '<td className="mapCheck">{i.verEnMapa&&i.mapId?<label><input type="checkbox" disabled={blocked} checked={on&&!blocked} onChange={()=>toggleFromIndex(i)}/><span>{blocked?"Temporalmente en corrección":on?"Activa":"Activar"}</span></label>:"—"}</td>'
new = '<td className="mapCheck">{i.verEnMapa&&i.mapId?<label title={blocked?"Temporalmente en corrección":on?"Quitar del mapa":"Mostrar en mapa"}><input type="checkbox" disabled={blocked} checked={on&&!blocked} onChange={()=>toggleFromIndex(i)}/></label>:"—"}</td>'
if old in s:
    s = s.replace(old, new, 1)
else:
    old2 = '<td className="mapCheck">{i.verEnMapa&&i.mapId?<label><input type="checkbox" checked={on} onChange={()=>toggleFromIndex(i)}/><span>{on?"Activa":"Activar"}</span></label>:"—"}</td>'
    if old2 in s:
        s = s.replace(old2, new, 1)

# 2) Sector / temática: texto simple y compacto, con tooltip para ver el nombre completo.
s = s.replace(
    '<td><span className="sectorTag">{itemSector(i)}</span></td>',
    '<td className="sectorCell" title={itemSector(i)}>{itemSector(i)}</td>',
    1,
)

# 3) Cobertura: quitar ruta/carpeta 02_DIM... que aparecía debajo del nombre.
post_block = '<td><strong>{i.nombre}</strong><small>{temporarilyDisabled(mapId)?"Temporalmente en corrección":(i.carpeta||"Repositorio visor")}</small></td>'
plain = '<td><strong>{i.nombre}</strong><small>{i.carpeta||"Repositorio visor"}</small></td>'
replacement = '<td className="coverageName"><strong>{i.nombre}</strong>{temporarilyDisabled(mapId)&&<small className="temporaryNote">Temporalmente en corrección</small>}</td>'
if post_block in s:
    s = s.replace(post_block, replacement, 1)
elif plain in s:
    s = s.replace(plain, replacement, 1)

# 4) Acortar ayuda del encabezado de Acciones.
s = s.replace(
    'Seleccionar = mostrar en mapa · Descargas GeoJSON/GPKG requieren clave de autorización',
    'Seleccionar = mostrar en mapa · Descargas requieren autorización',
    1,
)

page.write_text(s, encoding="utf-8")

css = Path("app/globals.css")
c = css.read_text(encoding="utf-8")
marker = "/* COMPACT_COVERAGE_INDEX_V1 */"
if marker not in c:
    c += r'''

/* COMPACT_COVERAGE_INDEX_V1 */
/* Ventana ajustable: arrastrar desde la esquina inferior derecha. */
.coverageIndex{
  width:min(94vw,1180px)!important;
  height:min(84vh,760px)!important;
  min-width:720px!important;
  min-height:420px!important;
  max-width:98vw!important;
  max-height:94vh!important;
  resize:both!important;
  overflow:hidden!important;
}
.coverageIndex.compact{
  width:min(76vw,900px)!important;
  height:150px!important;
  min-height:120px!important;
}
.coverageIndex .indexTableWrap{overflow:auto!important;min-height:0!important;}
.coverageIndex table{table-layout:fixed!important;min-width:980px!important;width:100%!important;}

/* Mapa: solo el clic de selección. */
.coverageIndex th:nth-child(1),.coverageIndex td:nth-child(1){width:42px!important;min-width:42px!important;max-width:42px!important;text-align:center!important;padding-left:4px!important;padding-right:4px!important;}
.coverageIndex .mapCheck label{display:grid!important;place-items:center!important;margin:0!important;}
.coverageIndex .mapCheck input{margin:0!important;width:15px!important;height:15px!important;}
.coverageIndex .mapCheck span{display:none!important;}

/* Dimensión y sector dejan de dominar visualmente. */
.coverageIndex th:nth-child(2),.coverageIndex td:nth-child(2){width:82px!important;}
.coverageIndex th:nth-child(3),.coverageIndex td:nth-child(3){width:150px!important;}
.coverageIndex .sectorCell{
  font-size:8px!important;
  font-weight:400!important;
  color:var(--muted)!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.coverageIndex .sectorTag{background:transparent!important;border:0!important;padding:0!important;font-weight:400!important;font-size:8px!important;color:var(--muted)!important;}

/* Cobertura gana jerarquía y se elimina la ruta 02_DIM... inferior. */
.coverageIndex th:nth-child(4),.coverageIndex td:nth-child(4){width:190px!important;}
.coverageIndex .coverageName strong{font-size:9px!important;line-height:1.25!important;}
.coverageIndex .coverageName>small:not(.temporaryNote){display:none!important;}
.coverageIndex .temporaryNote{display:block!important;margin-top:3px!important;font-size:7px!important;color:#9a563f!important;font-weight:700!important;}

/* Columnas técnicas más compactas. */
.coverageIndex th:nth-child(5),.coverageIndex td:nth-child(5){width:74px!important;}
.coverageIndex th:nth-child(6),.coverageIndex td:nth-child(6){width:58px!important;text-align:right!important;}
.coverageIndex th:nth-child(7),.coverageIndex td:nth-child(7){width:115px!important;}
.coverageIndex th:nth-child(8),.coverageIndex td:nth-child(8),.coverageIndex th:nth-child(9),.coverageIndex td:nth-child(9){width:82px!important;}
.coverageIndex th:nth-child(10),.coverageIndex td:nth-child(10){width:170px!important;}
.coverageIndex th,.coverageIndex td{padding:7px 6px!important;vertical-align:middle!important;}
.coverageIndex td small{font-size:7px!important;line-height:1.25!important;}
.coverageIndex .indexActions{gap:4px!important;flex-wrap:wrap!important;}
.coverageIndex .indexActions button{padding:5px 7px!important;font-size:8px!important;}

@media (max-width:900px){
  .coverageIndex{min-width:620px!important;width:96vw!important;height:88vh!important;}
}
'''
    css.write_text(c, encoding="utf-8")

print("Índice compacto aplicado: Mapa mínimo, Sector discreto, sin 02_DIM bajo cobertura y ventana redimensionable.")
