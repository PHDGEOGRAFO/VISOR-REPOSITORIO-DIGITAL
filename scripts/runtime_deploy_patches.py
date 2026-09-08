from pathlib import Path

# -----------------------------------------------------------------------------
# Parches estables de UI que ya aplicaba deploy-pages.yml
# -----------------------------------------------------------------------------
p = Path("app/page.tsx")
s = p.read_text(encoding="utf-8")

s = s.replace(
    'function itemDimension(i:IndexItem){return (i as any).dimensionPladeco||"POR CLASIFICAR"}',
    'function itemDimension(i:IndexItem){return String((i as any).dimensionPladeco||"POR CLASIFICAR").replace("DIMENSIÓN ECONÓMICA","DIMENSIÓN ECONOMICA")}',
)
if "function displayFieldName(" not in s:
    s = s.replace(
        'function itemSector(i:IndexItem){return (i as any).sector||"Por clasificar"}',
        'function itemSector(i:IndexItem){return (i as any).sector||"Por clasificar"}\nfunction displayFieldName(v:string){return String(v||"").replace(/^CSV_/i,"")}',
    )
if "function categoryLegendColor(" not in s:
    anchor = 'function displayFieldName(v:string){return String(v||"").replace(/^CSV_/i,"")}'
    helper = '''function categoryLegendColor(raw:any,fieldName:string){if(raw==null||String(raw).trim()==="")return "#c7cdd1";const field=String(fieldName||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");const num=Number(raw);if(Number.isFinite(num)&&(field==="norm"||field.endsWith("_norm")||field.includes("normaliz"))){const v=Math.max(0,Math.min(1,num));return `hsl(210 62% ${88-v*48}%)`}const v=String(raw),n=v.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");if(n.includes("muy bajo"))return "hsl(210 35% 88%)";if(n==="bajo"||n.includes(" bajo"))return "hsl(210 42% 74%)";if(n.includes("medio"))return "hsl(210 50% 60%)";if(n==="alto"||n.includes(" alto"))return "hsl(210 58% 46%)";if(n.includes("muy alto"))return "hsl(210 65% 32%)";let h=0;for(const c of v)h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 50% 48%)`}'''
    s = s.replace(anchor, anchor + "\n" + helper)

s = s.replace('<option key={f} value={f}>{f}</option>', '<option key={f} value={f}>{displayFieldName(f)}</option>')
s = s.replace('<b>Campo: {disaggregateField}</b>', '<b>Campo: {displayFieldName(disaggregateField)}</b>')
s = s.replace('<strong>Desagregación · {disaggregateField}</strong>', '<strong>Desagregación · {displayFieldName(disaggregateField)}</strong>')
s = s.replace('` · Desagregado por ${disaggregateField}`', '` · Desagregado por ${displayFieldName(disaggregateField)}`')
s = s.replace('<th key={f}>{f}</th>', '<th key={f}>{displayFieldName(f)}</th>')
s = s.replace('<strong>{k}</strong><span>{String(v??"Sin dato")}</span>', '<strong>{displayFieldName(k)}</strong><span>{String(v??"Sin dato")}</span>')
old_color = 'style={{background:`hsl(${(Math.abs([...v].reduce((a,c)=>a+c.charCodeAt(0),0))*47)%360} 58% 45%)`}}'
s = s.replace(old_color, 'style={{background:categoryLegendColor(v,disaggregateField)}}')
if 'Manual de uso</a>' not in s:
    s = s.replace(
        '>Ayuda</button><button onClick={printPdf}>PDF</button>',
        '>Ayuda</button><a href={`${BASE_PATH}/manual-uso-visor.html`} download="Manual_uso_Visor_Territorial.html" style={{display:"inline-flex",alignItems:"center",padding:"0 12px",border:"1px solid #ffffff55",color:"#fff",textDecoration:"none",fontSize:"11px",fontWeight:700}}>Manual de uso</a><button onClick={printPdf}>PDF</button>',
    )

# -----------------------------------------------------------------------------
# Prueba controlada: las 8 coberturas con render problemático quedan reactivadas
# -----------------------------------------------------------------------------
if "const TEMPORARILY_DISABLED=" not in s:
    anchor = 'const thematicGroups=groups.filter(([c])=>c!=="BASE");'
    disabled = '''const thematicGroups=groups.filter(([c])=>c!=="BASE");
const TEMPORARILY_DISABLED=new Set<string>([]);
const temporarilyDisabled=(id:string)=>TEMPORARILY_DISABLED.has(id);'''
    if anchor not in s:
        raise RuntimeError("No se encontró thematicGroups para instalar bloqueo temporal")
    s = s.replace(anchor, disabled, 1)

old = 'const toggle=(id:string)=>setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);const ensureActive=(id:string)=>setActive(a=>a.includes(id)?a:[...a,id]);'
new = 'const toggle=(id:string)=>{if(temporarilyDisabled(id))return;setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id])};const ensureActive=(id:string)=>{if(temporarilyDisabled(id))return;setActive(a=>a.includes(id)?a:[...a,id])};'
s = s.replace(old, new, 1)

old = 'const openFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id))return;ensureActive(id);setSelected(id)};'
new = 'const openFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id)||temporarilyDisabled(id))return;ensureActive(id);setSelected(id)};'
s = s.replace(old, new, 1)

old = 'const toggleFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id))return;setActive(a=>{'
new = 'const toggleFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id)||temporarilyDisabled(id))return;setActive(a=>{'
s = s.replace(old, new, 1)

old = 'return <button key={i.id} className={on?"on":""} onClick={()=>toggleFromIndex(i)}><span>{on?"✓":"+"}</span><b>{i.nombre}</b><small>{itemDimension(i).replace("DIMENSIÓN ","")} · {itemSector(i)}</small></button>'
new = 'const blocked=temporarilyDisabled(id);return <button key={i.id} disabled={blocked} className={on?"on":""} onClick={()=>toggleFromIndex(i)}><span>{blocked?"×":on?"✓":"+"}</span><b>{i.nombre}</b><small>{blocked?"Temporalmente en corrección":`${itemDimension(i).replace("DIMENSIÓN ","")} · ${itemSector(i)}`}</small></button>'
s = s.replace(old, new, 1)

old = 'return <tr key={i.id}><td className="mapCheck">{i.verEnMapa&&i.mapId?<label><input type="checkbox" checked={on} onChange={()=>toggleFromIndex(i)}/><span>{on?"Activa":"Activar"}</span></label>:"—"}</td>'
new = 'const blocked=temporarilyDisabled(mapId);return <tr key={i.id}><td className="mapCheck">{i.verEnMapa&&i.mapId?<label><input type="checkbox" disabled={blocked} checked={on&&!blocked} onChange={()=>toggleFromIndex(i)}/><span>{blocked?"Temporalmente en corrección":on?"Activa":"Activar"}</span></label>:"—"}</td>'
s = s.replace(old, new, 1)

old = '<td><strong>{i.nombre}</strong><small>{i.carpeta||"Repositorio visor"}</small></td>'
new = '<td><strong>{i.nombre}</strong><small>{temporarilyDisabled(mapId)?"Temporalmente en corrección":(i.carpeta||"Repositorio visor")}</small></td>'
s = s.replace(old, new, 1)

old = '{i.verEnMapa&&i.mapId&&<button className="applyAction" onClick={()=>openFromIndex(i)}>Seleccionar</button>}'
new = '{i.verEnMapa&&i.mapId&&<button disabled={temporarilyDisabled(mapId)} className="applyAction" onClick={()=>openFromIndex(i)}>{temporarilyDisabled(mapId)?"En corrección":"Seleccionar"}</button>}'
s = s.replace(old, new, 1)

old = '<section className="map"><InteractiveMap data={data} active={active}'
new = '<section className="map"><InteractiveMap data={data} active={active.filter(id=>!temporarilyDisabled(id))}'
s = s.replace(old, new, 1)

s = s.replace(
    'if(a.type==="activate_layer"){ensureActive(a.layerId);setSelected(a.layerId);if(polygon)setSpatialSelection(featuresInPolygon(data[a.layerId],polygon))}',
    'if(a.type==="activate_layer"&&!temporarilyDisabled(a.layerId)){ensureActive(a.layerId);setSelected(a.layerId);if(polygon)setSpatialSelection(featuresInPolygon(data[a.layerId],polygon))}',
    1,
)

p.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# Motor de render V3: polígonos pesados + correcciones TypeScript
# -----------------------------------------------------------------------------
p = Path("app/InteractiveMap.tsx")
m = p.read_text(encoding="utf-8")

# Limitar cantidad de polígonos que llegan al SVG.
m = m.replace(
    'const MAX_RENDER_FEATURES=1800,MAX_POLYGON_RENDER_FEATURES=320,MAX_LINE_RENDER_FEATURES=650,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    'const MAX_RENDER_FEATURES=1800,MAX_POLYGON_RENDER_FEATURES=80,MAX_LINE_RENDER_FEATURES=650,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    1,
)
m = m.replace(
    'const MAX_RENDER_FEATURES=1800,MAX_POLYGON_RENDER_FEATURES=180,MAX_LINE_RENDER_FEATURES=650,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    'const MAX_RENDER_FEATURES=1800,MAX_POLYGON_RENDER_FEATURES=80,MAX_LINE_RENDER_FEATURES=650,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    1,
)

# El cálculo de bounds anterior recorría cada vértice de cada polígono antes de
# simplificar el dibujo. En capas como Áreas Verdes / Averde PRC eso puede bloquear
# el navegador. El muestreo mantiene suficiente precisión para decidir visibilidad.
old_bounds = 'function coordinateBounds(coords:any,b=[Infinity,Infinity,-Infinity,-Infinity] as number[]){if(Array.isArray(coords)&&coords.length>=2&&typeof coords[0]==="number"&&typeof coords[1]==="number"){const x=coords[0],y=coords[1];if(Number.isFinite(x)&&Number.isFinite(y)){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)}return b}if(Array.isArray(coords))for(const c of coords)coordinateBounds(c,b);return b}'
new_bounds = 'function coordinateBounds(coords:any,b=[Infinity,Infinity,-Infinity,-Infinity] as number[]){if(Array.isArray(coords)&&coords.length>=2&&typeof coords[0]==="number"&&typeof coords[1]==="number"){const x=coords[0],y=coords[1];if(Number.isFinite(x)&&Number.isFinite(y)){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)}return b}if(Array.isArray(coords)){const n=coords.length;if(n>128){const step=Math.ceil(n/128);for(let i=0;i<n;i+=step)coordinateBounds(coords[i],b);coordinateBounds(coords[n-1],b)}else for(const c of coords)coordinateBounds(c,b)}return b}'
m = m.replace(old_bounds, new_bounds, 1)

m = m.replace(
    'function linePath(f:GeoFeature,z:number,cx:number,cy:number,maxParts=MAX_PARTS,maxPoints=MAX_POINTS_PER_PART){const lines0=f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates;const lines=sampleArray(lines0,maxParts);return lines.map((line:number[][])=>sampleArray(line,maxPoints).map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")).join(" ")}',
    'function linePath(f:GeoFeature,z:number,cx:number,cy:number,maxParts=MAX_PARTS,maxPoints=MAX_POINTS_PER_PART){const lines0=(f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates) as number[][][];const lines=sampleArray(lines0,maxParts);return lines.map((line:number[][])=>sampleArray(line,maxPoints).map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")).join(" ")}',
    1,
)

# Polígonos pesados: menos partes y menos vértices por anillo.
m = m.replace(
    'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const heavy=fc.features.length>600;const layerDetail=heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;',
    'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=polygonLayer&&fc.features.length>80;const heavy=polygonHeavy||fc.features.length>600;const layerDetail=polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;',
    1,
)
m = m.replace(
    'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=polygonLayer&&fc.features.length>150;const heavy=polygonHeavy||fc.features.length>600;const layerDetail=polygonHeavy?{parts:Math.min(detail.parts,8),points:Math.min(detail.points,22)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;',
    'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=polygonLayer&&fc.features.length>80;const heavy=polygonHeavy||fc.features.length>600;const layerDetail=polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;',
    1,
)

p.write_text(m, encoding="utf-8")

# -----------------------------------------------------------------------------
# Impresión completa (parche estable previo)
# -----------------------------------------------------------------------------
css = Path("app/globals.css")
c = css.read_text(encoding="utf-8")
marker = "/* PRINT_COMPLETO_DEPLOY */"
if marker not in c:
    c += '''
/* PRINT_COMPLETO_DEPLOY */
@media print{
@page{size:Letter landscape;margin:5mm}
body>*{display:none!important}body>main{display:block!important}
main>header,.sidebar,.layerControl,.zoomControl,.mapAttribution,.topActions,.santiPanel,.legacyTools,.selectionButtons,.toolButtons,.clearSelection,.downloadAuthBackdrop,.indexBackdrop{display:none!important}
.workspace{display:grid!important;grid-template-columns:minmax(0,1fr) 70mm!important;gap:3mm!important;height:auto!important;min-height:0!important;align-items:start!important}
.map{display:block!important;position:relative!important;width:auto!important;height:190mm!important;overflow:hidden!important;border:1px solid #697671!important;background:#eef0ed!important}
.inspector{display:block!important;position:static!important;width:auto!important;height:190mm!important;overflow:hidden!important;padding:3mm!important;background:#fff!important;border:1px solid #aeb7b2!important}
.analysisTools{display:block!important;position:absolute!important;z-index:30!important;right:4mm!important;top:4mm!important;width:61mm!important;max-height:105mm!important;overflow:hidden!important;padding:2.5mm!important;background:#fffffff2!important;border:1px solid #9aa7a1!important;box-shadow:none!important}
.analysisTools label,.analysisTools small,.analysisTools select,.analysisTools .analysisResult strong{font-size:6.2pt!important;line-height:1.25!important}
.analysisTools select{padding:1mm!important;background:#fff!important;border:1px solid #aeb7b2!important}
.visualBlock{display:none!important}.printMapDecor{display:block!important}.printAnalysisState{display:none!important}
.inspector .title h2{font-size:13pt!important}.inspector .title p,.inspector>p{font-size:7pt!important;line-height:1.35!important}.inspector .summary{padding:2mm 0!important}.inspector .summary div{padding:2mm!important;margin:0!important;font-size:6.8pt!important}.featureDetails p{display:grid!important;grid-template-columns:26mm 1fr!important;gap:1mm!important;margin:0!important;padding:1.1mm 0!important;border-bottom:1px solid #e1e5e2!important}.featureDetails strong,.featureDetails span{font-size:6.2pt!important;line-height:1.25!important;overflow-wrap:anywhere!important}
}
'''
    css.write_text(c, encoding="utf-8")

print("Parches de despliegue aplicados: UI estable + render V3 polígonos pesados + 8 coberturas reactivadas.")
