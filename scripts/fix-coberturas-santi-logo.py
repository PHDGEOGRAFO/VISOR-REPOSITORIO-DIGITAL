from pathlib import Path
import json,re

page=Path('app/page.tsx')
s=page.read_text(encoding='utf-8')

# Logo: ruta relativa al documento publicado en GitHub Pages.
s=s.replace('src={`${BASE_PATH}/logo-munistgo.png`}', 'src="./logo-munistgo.png"')

# Herramientas trabajan sobre la cobertura seleccionada, no sobre una lista fija Grifos/Bibliotecas.
s=s.replace('const pointLayers=layers.filter(l=>l.geometry==="Punto"&&!l.mapTool);\n','')
s=re.sub(r' const choosePointLayer=\(id:string\)=>\{if\(!id\)return;setSelected\(id\);ensureActive\(id\);setFeature\(null\);setSpatialSelection\(null\)\};\n','',s)
old='<label className="pointChooser">Variable de puntos<select value={selectedLayer.geometry==="Punto"?selected:""} onChange={e=>choosePointLayer(e.target.value)}><option value="">Seleccione para Puntos / Clúster / Calor</option>{pointLayers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>'
new='<div className="activeCoverage"><span>Cobertura activa</span><strong>{selectedLayer.name}</strong><small>{selectedLayer.geometry==="Punto"?"Disponible para Puntos / Clúster / Calor":"Para Puntos / Clúster / Calor seleccione una cobertura de puntos desde el Índice o SANTI"}</small></div>'
if old not in s:
    raise SystemExit('No se encontró selector fijo de puntos')
s=s.replace(old,new)
s=s.replace('<button className={viz==="simple"?"on":""} onClick={()=>setMode("simple")}>Puntos</button><button className={viz==="cluster"?"on":""} onClick={()=>setMode("cluster")}>Clúster</button><button className={viz==="heat"?"on":""} onClick={()=>setMode("heat")}>Calor</button>',
'''<button disabled={selectedLayer.geometry!=="Punto"} className={viz==="simple"?"on":""} onClick={()=>setMode("simple")}>Puntos</button><button disabled={selectedLayer.geometry!=="Punto"} className={viz==="cluster"?"on":""} onClick={()=>setMode("cluster")}>Clúster</button><button disabled={selectedLayer.geometry!=="Punto"} className={viz==="heat"?"on":""} onClick={()=>setMode("heat")}>Calor</button>''')
page.write_text(s,encoding='utf-8')

# SANTI: prioridad absoluta a preguntas espaciales específicas sobre el polígono.
santi=Path('app/santi.ts')
t=santi.read_text(encoding='utf-8')
needle=' const q=norm(query),actions:SantiAction[]=[];const isCount=/cuant|numero|cantidad|total/.test(q);\n'
insert=''' const q=norm(query),actions:SantiAction[]=[];const isCount=/cuant|numero|cantidad|total/.test(q);\n const asksPolygon=/poligono|seleccion|seleccionad|dentro|area dibujada/.test(q);\n const polygonCount=(id:string)=>ctx.polygonResults?.find(r=>r.id===id)?.count??0;\n if(/grifos?/.test(q)&&asksPolygon&&isCount){if(!ctx.polygonResults){actions.push({type:"set_viz",mode:"draw"});return{summary:"Primero dibuja o conserva un polígono de selección. Luego contaré únicamente los grifos que intersectan esa selección.",actions};}const n=polygonCount("grifos");return{summary:`En el polígono seleccionado hay ${n.toLocaleString("es-CL")} grifos. El total de la cobertura completa es ${ctx.counts.grifos.toLocaleString("es-CL")}.`,actions};}\n if(/bibliotecas?/.test(q)&&asksPolygon&&isCount){if(!ctx.polygonResults){actions.push({type:"set_viz",mode:"draw"});return{summary:"Primero dibuja o conserva un polígono de selección. Luego contaré únicamente las bibliotecas que intersectan esa selección.",actions};}const n=polygonCount("bibliotecas");return{summary:`En el polígono seleccionado hay ${n.toLocaleString("es-CL")} bibliotecas. El total de la cobertura completa es ${ctx.counts.bibliotecas.toLocaleString("es-CL")}.`,actions};}\n'''
if needle not in t:
    raise SystemExit('No se encontró inicio de runSanti')
t=t.replace(needle,insert)
santi.write_text(t,encoding='utf-8')

# Grifos y Bibliotecas pasan a estar explícitamente indexados como coberturas publicadas.
p=Path('public/catalog/index_coberturas.json')
j=json.loads(p.read_text(encoding='utf-8'))
items=j.setdefault('items',[])
existing={str(x.get('id')) for x in items}
extra=[
 {"id":"grifos","mapId":"grifos","tema":"SEG","dimensionPladeco":"DIMENSIÓN SOCIOCULTURAL","sector":"Seguridad","nombre":"Grifos","geometria":"Punto","escala":"Comuna","contenedor":"3. REPOSITORIO VISOR","tipoContenedor":"Cobertura publicada","subcapa":"grifos","campoClave":"","estado":"PUBLICADA","validacion":"VALIDADA PARA VISUALIZACIÓN","registros":1319,"verEnMapa":True,"download":"/data/grifos.geojson","observaciones":"Cobertura temática. No se activa en el inicio predeterminado; se abre desde Índice o SANTI."},
 {"id":"bibliotecas","mapId":"bibliotecas","tema":"SOC","dimensionPladeco":"DIMENSIÓN SOCIOCULTURAL","sector":"Patrimonio y cultura","nombre":"Bibliotecas 2025","geometria":"Punto","escala":"Comuna","contenedor":"3. REPOSITORIO VISOR","tipoContenedor":"Cobertura publicada","subcapa":"bibliotecas_2025","campoClave":"","estado":"PUBLICADA","validacion":"VALIDADA PARA VISUALIZACIÓN","registros":"","verEnMapa":True,"download":"/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson","observaciones":"Cobertura temática. No se activa en el inicio predeterminado; se abre desde Índice o SANTI."}
]
for x in extra:
    if x['id'] not in existing: items.append(x)
p.write_text(json.dumps(j,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# Estilo mínimo para cobertura activa y botones deshabilitados.
css=Path('app/map-gray.css')
c=css.read_text(encoding='utf-8')
if '.activeCoverage{' not in c:
    c+='''\n.activeCoverage{display:grid;gap:4px;padding:8px 9px;margin:7px 0;border:1px solid #b8c6d8;background:#f5f8fb}.activeCoverage span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#51657a}.activeCoverage strong{font-size:13px;color:#072e6d}.activeCoverage small{font-size:10px;line-height:1.35;color:#52606d}.toolButtons button:disabled{opacity:.4;cursor:not-allowed;background:#eef1f4!important;color:#667!important;border-color:#c8d0d8!important}\n'''
css.write_text(c,encoding='utf-8')
print('OK: logo, herramientas por cobertura, SANTI espacial e índice corregidos')
