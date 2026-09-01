from pathlib import Path
import json, re, sqlite3, subprocess

ROOT=Path('.')
TMP=Path('/tmp/gis'); TMP.mkdir(parents=True,exist_ok=True)
CONFIGS=[
    {'id':'1HTUXi9L4legMkzvunoBKJp3W8DIru30u','file':'04_DIM_ECONOMICA_VF.gpkg','out':'economica','theme':'ECO','dimension':'DIMENSIÓN ECONOMICA','sector':'Actividad económica y comercio'},
    {'id':'1LDgOB3cFIpTIxPKAZyCmy3G-W9ifkEqN','file':'03_DIM_SOCIOCULTURAL_VF.gpkg','out':'sociocultural','theme':'SOC','dimension':'DIMENSIÓN SOCIOCULTURAL','sector':'Por clasificar'},
]

def run(cmd):
    print('+',' '.join(map(str,cmd)))
    subprocess.run(list(map(str,cmd)),check=True)

def gtype(g):
    x=(g or '').upper()
    if 'POINT' in x:return 'Punto'
    if 'LINE' in x:return 'Línea'
    return 'Polígono'

def lid(it): return 'vf-'+it['slug']

def friendly(table):
    x=re.sub(r'^(ECO|SOC|SEG|TUR|CUL|PAT)_(PTO|POL|LIN)_','',table)
    return x.replace('_',' ').title()

all_items=[]
(ROOT/'public/data/gpkg').mkdir(parents=True,exist_ok=True)
for cfg in CONFIGS:
    assert '_VF' in cfg['file']
    gpkg=TMP/cfg['file']
    run(['gdown',f"https://drive.google.com/uc?id={cfg['id']}",'-O',gpkg])
    if not gpkg.exists() or gpkg.stat().st_size<1024: raise RuntimeError(f'Archivo invalido: {gpkg}')
    out=ROOT/'public/data'/cfg['out']; out.mkdir(parents=True,exist_ok=True)
    run(['cp',gpkg,ROOT/'public/data/gpkg'/cfg['file']])
    con=sqlite3.connect(gpkg)
    rows=con.execute("select c.table_name,coalesce(g.geometry_type_name,''),coalesce(c.srs_id,'') from gpkg_contents c left join gpkg_geometry_columns g on c.table_name=g.table_name where c.data_type='features' order by c.table_name").fetchall()
    if not rows: raise RuntimeError(f'Sin capas espaciales: {cfg["file"]}')
    manifest=[]
    for table,geom,srid in rows:
        slug=re.sub(r'[^a-z0-9]+','-',table.lower()).strip('-')
        gj=out/f'{slug}.geojson'
        run(['ogr2ogr','-f','GeoJSON','-t_srs','EPSG:4326',gj,gpkg,table,'-lco','RFC7946=YES','-lco','COORDINATE_PRECISION=6'])
        count=con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        it={'table':table,'slug':slug,'geometry':geom,'source_srid':srid,'records':count,'theme':cfg['theme'],'dimension':cfg['dimension'],'sector':cfg['sector'],'geojson':f'/data/{cfg["out"]}/{slug}.geojson','gpkg':f'/data/gpkg/{cfg["file"]}','container':cfg['file']}
        manifest.append(it); all_items.append(it)
    mp=out/f"manifest_{cfg['file'][:-5].lower()}.json"
    mp.write_text(json.dumps({'file':cfg['file'],'total':len(manifest),'items':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
    print(cfg['file'],len(manifest),'capas')

p=ROOT/'app/page.tsx'; s=p.read_text(encoding='utf-8')
palette=['#7a5b3a','#386f8a','#7b5685','#5c7a43','#9a623f','#4b6d9a','#8a4f64','#6f7f3f','#825c45','#526f78']
layer_lines=[]; style_lines=[]
for i,it in enumerate(all_items):
    gt=gtype(it['geometry']); color=palette[i%len(palette)]
    layer_lines.append(f' {{id:"{lid(it)}",name:{json.dumps(friendly(it["table"]),ensure_ascii=False)},theme:"{it["theme"]}",geometry:"{gt}",url:`${{BASE_PATH}}{it["geojson"]}`,color:"{color}",description:{json.dumps("Cobertura publicada desde "+it["container"]+".",ensure_ascii=False)},source:"{it["container"]}"}}')
    if gt=='Punto': st=f'{{color:"{color}",pointRadius:4}}'
    elif gt=='Línea': st=f'{{color:"{color}",width:1.25,opacity:.9}}'
    else: st=f'{{color:"{color}",fill:"{color}",width:.9,opacity:.15}}'
    style_lines.append(f' "{lid(it)}":{st}')

start='/* GENERATED_VF_LAYERS_START */'; end='/* GENERATED_VF_LAYERS_END */'
block=start+'\n'+',\n'.join(layer_lines)+'\n '+end
if start in s:
    s=re.sub(re.escape(start)+r'.*?'+re.escape(end),block,s,flags=re.S)
else:
    anchor=' {id:"bibliotecas",name:"Bibliotecas 2025",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson`,color:"#2877a6",description:"Variable temática sociocultural. Se activa desde Herramientas, Índice o SANTI.",source:"Biblioteca Digital"}'
    if anchor not in s: raise RuntimeError('No se encontro ancla de layers')
    s=s.replace(anchor,anchor+',\n '+block,1)

sstart='/* GENERATED_VF_STYLES_START */'; send='/* GENERATED_VF_STYLES_END */'
sblock=sstart+'\n'+',\n'.join(style_lines)+'\n '+send
if sstart in s:
    s=re.sub(re.escape(sstart)+r'.*?'+re.escape(send),sblock,s,flags=re.S)
else:
    anchor='bibliotecas:{color:"#2877a6",pointRadius:6}'
    if anchor not in s: raise RuntimeError('No se encontro ancla de styles')
    s=s.replace(anchor,anchor+',\n '+sblock,1)

old='  layers.forEach(layer=>{\n   if(data[layer.id]&&!(layer.populationJoin&&Object.keys(population).length))return;'
new='  layers.forEach(layer=>{\n   const shouldLoad=layer.theme==="BASE"||layer.activeDefault||active.includes(layer.id)||layer.id===selected;\n   if(!shouldLoad)return;\n   if(data[layer.id]&&!(layer.populationJoin&&Object.keys(population).length))return;'
if old in s:s=s.replace(old,new,1)
if ' },[population]);' in s:s=s.replace(' },[population]);',' },[population,active,selected]);',1)

old=' const nperValues=sourceFeatures.map(f=>Number(f.properties.n_per)).filter(Number.isFinite),nperSum=nperValues.reduce((a,b)=>a+b,0),pointCount=selectedData.features.filter(f=>f.geometry.type==="Point").length;'
new=' const manzanasAnalisis=polygon?featuresInPolygon(data.manzana??empty,polygon):[];\n const nperValues=manzanasAnalisis.map(f=>Number(f.properties.n_per)).filter(Number.isFinite),nperSum=nperValues.reduce((a,b)=>a+b,0),pointCount=selectedData.features.filter(f=>f.geometry.type==="Point").length;'
if old in s:s=s.replace(old,new,1)

hook=' useEffect(()=>{if(analysis!=="Isócronas"||streets.features.length)return;fetch(`${BASE_PATH}/data/calles_santiago.geojson`).then(r=>r.ok?r.json():empty).then(setStreets).catch(()=>setStreets(empty))},[analysis,streets.features.length]);'
add=hook+'\n useEffect(()=>{if(analysis==="Suma n_per"||analysis==="Promedio n_per"){setActive(a=>a.includes("manzana")?a:[...a,"manzana"]);setSelectionMode("Polígono")}},[analysis]);'
if hook in s and 'a.includes("manzana")?a:[...a,"manzana"]' not in s:s=s.replace(hook,add,1)

s=s.replace('analysis==="Suma n_per"?`${nperSum.toLocaleString("es-CL")} personas`','analysis==="Suma n_per"?(polygon?`${nperSum.toLocaleString("es-CL")} personas · ${manzanasAnalisis.length.toLocaleString("es-CL")} manzanas Censo 2024`:`Dibuje un polígono · Base: Manzanas Censo 2024 · campo n_per`)')
s=s.replace('analysis==="Promedio n_per"?`${(nperValues.length?nperSum/nperValues.length:0).toLocaleString("es-CL",{maximumFractionDigits:1})} promedio`','analysis==="Promedio n_per"?(polygon?`${(nperValues.length?nperSum/nperValues.length:0).toLocaleString("es-CL",{maximumFractionDigits:1})} promedio · ${manzanasAnalisis.length.toLocaleString("es-CL")} manzanas Censo 2024`:`Dibuje un polígono · Base: Manzanas Censo 2024 · campo n_per`)')
needle='{disaggregateField?` · Desagregado por ${disaggregateField}`:""}</div>'
rep='{disaggregateField?` · Desagregado por ${disaggregateField}`:""}{(analysis==="Suma n_per"||analysis==="Promedio n_per")?` · Base: Manzanas Censo 2024 · campo n_per`:""}</div>'
if needle in s:s=s.replace(needle,rep,1)
p.write_text(s,encoding='utf-8')

cp=ROOT/'public/catalog/index_coberturas.json'; cat=json.loads(cp.read_text(encoding='utf-8'))
base=[x for x in cat.get('items',[]) if not str(x.get('contenedor','')).endswith('_VF.gpkg')]
for it in all_items:
    gt=gtype(it['geometry']); idv=lid(it)
    base.append({'id':idv,'mapId':idv,'tema':it['theme'],'dimensionPladeco':it['dimension'],'sector':it['sector'],'nombre':friendly(it['table']),'carpeta':it['container'][:-5],'geometria':gt,'escala':'Comuna','contenedor':it['container'],'tipoContenedor':'GeoPackage VF','subcapa':it['table'],'campoClave':'','estado':'PUBLICADA','validacion':'VALIDADA PARA VISUALIZACIÓN','registros':it['records'],'crs':f'EPSG:{it["source_srid"]} (fuente) / EPSG:4326 (web)','verEnMapa':True,'download':it['geojson'],'observaciones':'Carga oficial desde versión final _VF. GeoJSON web derivado de la subcapa; GPKG permanece como respaldo por dimensión.'})
cat['items']=base; cat['total']=len(base); cat['generatedAt']='2026-09-01'; cat['generatedFrom']='Versiones finales _VF + capas base operativas'
cp.write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

print('TOTAL VF',len(all_items),'TOTAL CATALOGO',len(base))
