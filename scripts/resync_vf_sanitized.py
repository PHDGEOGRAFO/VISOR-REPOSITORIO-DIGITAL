from pathlib import Path
import json,re,sqlite3,subprocess,shutil,unicodedata

ROOT=Path('.')
SRC=Path('/tmp/vf')
PAGE=ROOT/'app/page.tsx'
CAT=ROOT/'public/catalog/index_coberturas.json'

CFG=[
 ('01','01_DIM_URBANA_VF.gpkg','urbana','URB','DIMENSIÓN URBANA','Planificación urbana y suelo / Movilidad e infraestructura','#315d8a'),
 ('02','02_DIM_AMBIENTAL_VF.gpkg','ambiental','AMB','DIMENSIÓN AMBIENTAL','Áreas verdes y vegetación / Residuos, reciclaje y calidad ambiental','#527a43'),
 ('03','03_DIM_SOCIOCULTURAL_VF.gpkg','sociocultural','SOC','DIMENSIÓN SOCIOCULTURAL','Seguridad / Patrimonio y cultura / Turismo','#7b5685'),
 ('04','04_DIM_ECONOMICA_VF.gpkg','economica','ECO','DIMENSIÓN ECONÓMICA','Actividad económica y comercio','#9a623f'),
 ('05','05_DIM_INSTITUCIONAL_VF.gpkg','institucional','INS','DIMENSIÓN INSTITUCIONAL','Gestión municipal y activos institucionales','#6b5a83'),
]
PALETTE=['#386f8a','#7b5685','#5c7a43','#9a623f','#4b6d9a','#8a4f64','#6f7f3f','#825c45','#526f78','#7a5b3a']
SENSITIVE=['rut','run','email','correo','mail','telefono','fono','celular','contacto','responsable','encargado','propietario','titular','dueno','dueño','apellido','fecha_nac','nacimiento','clave','password','contrasena','contraseña','presidente','secretario','tesorero','c__de_id','c_de_id']

def norm(s): return ''.join(c for c in unicodedata.normalize('NFD',str(s).lower()) if unicodedata.category(c)!='Mn')
def slug(s): return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',norm(s))).strip('-')
def sensitive(k):
 n=norm(k).replace(' ','_')
 return any(norm(x).replace(' ','_') in n for x in SENSITIVE)
def friendly(t):
 x=re.sub(r'^(AMB|ECO|SOC|URB|INS|ADM|TUR)_(PTO|POL|LIN)_','',t,flags=re.I)
 return x.replace('_',' ').title().replace('Prc','PRC').replace('Ine','INE').replace('Ndvi','NDVI').replace('Sii','SII')
def geomlabel(g):
 u=(g or '').upper(); return 'Punto' if 'POINT' in u else ('Línea' if 'LINE' in u else 'Polígono')
def pick(prefix):
 c=[p for p in SRC.rglob('*.gpkg') if re.match(rf'^{re.escape(prefix)}[-_]',p.name,re.I) and '_VF' in p.name.upper()]
 if not c: raise RuntimeError(f'No se encontró GPKG VF para dimensión {prefix}')
 return sorted(c,key=lambda p:p.stat().st_mtime,reverse=True)[0]
def run(cmd):
 print('+',' '.join(map(str,cmd))); subprocess.run(list(map(str,cmd)),check=True)

def layer_id(prefix,table):
 s=slug(table)
 if prefix in ('02','03','04'): return 'vf-'+s
 return 'vf-'+({'01':'urb','05':'ins'}[prefix])+'-'+s

def safe_columns(con,table):
 cols=[r[1] for r in con.execute('pragma table_info("'+table.replace('"','""')+'")')]
 return [c for c in cols if c.lower() not in ('geom','geometry') and not sensitive(c)]

all_items=[]; layer_defs={}; manifests={}; report=[]
(ROOT/'public/data/gpkg').mkdir(parents=True,exist_ok=True)

for prefix,canonical,folder,theme,dim,sector,basecolor in CFG:
 src=pick(prefix); dst=ROOT/'public/data/gpkg'/canonical
 print('\nFUENTE',src,'->',dst)
 shutil.copy2(src,dst)
 outdir=ROOT/'public/data'/folder
 if outdir.exists(): shutil.rmtree(outdir)
 outdir.mkdir(parents=True)
 if prefix=='05' and (ROOT/'public/data/administrativa').exists(): shutil.rmtree(ROOT/'public/data/administrativa')
 con=sqlite3.connect(dst)
 rows=con.execute("SELECT c.table_name,coalesce(g.geometry_type_name,''),coalesce(g.srs_id,c.srs_id) FROM gpkg_contents c LEFT JOIN gpkg_geometry_columns g ON c.table_name=g.table_name WHERE c.data_type='features' ORDER BY c.table_name").fetchall()
 manifest=[]; defs=[]
 for idx,(table,gtype,srs) in enumerate(rows):
  count=con.execute('SELECT COUNT(*) FROM "'+table.replace('"','""')+'"').fetchone()[0]
  attrs=safe_columns(con,table)
  removed=[r[1] for r in con.execute('pragma table_info("'+table.replace('"','""')+'")') if sensitive(r[1])]
  fname=slug(table)+'.geojson'; out=outdir/fname
  cmd=['ogr2ogr','-f','GeoJSON','-t_srs','EPSG:4326',str(out),str(dst),table,'-lco','RFC7946=YES','-lco','COORDINATE_PRECISION=6']
  if attrs: cmd += ['-select',','.join(attrs)]
  run(cmd)
  fc=json.loads(out.read_text(encoding='utf-8')); valid=len(fc.get('features',[]))
  keys=sorted({k for f in fc.get('features',[])[:1000] for k in (f.get('properties') or {}).keys()})
  bad=[k for k in keys if sensitive(k)]
  if bad: raise RuntimeError(f'Campos sensibles aún publicados en {table}: {bad}')
  lid=layer_id(prefix,table); color=PALETTE[(idx+int(prefix))%len(PALETTE)]
  mapid='bibliotecas' if table.upper()=='SOC_PTO_BIBLIOTECAS_VF_2025' else lid
  item={'table':table,'slug':slug(table),'geometry':gtype,'source_srid':srs,'records':count,'web_records':valid,'theme':theme,'dimension':dim,'sector':sector,'geojson':f'/data/{folder}/{fname}','gpkg':f'/data/gpkg/{canonical}','container':canonical,'id':lid,'mapId':mapid,'removed_sensitive':removed}
  manifest.append(item); all_items.append(item)
  if mapid!='bibliotecas':
   defs.append(f' {{id:"{lid}",name:{json.dumps(friendly(table),ensure_ascii=False)},theme:"{theme}",geometry:"{geomlabel(gtype)}",url:`${{BASE_PATH}}/data/{folder}/{fname}`,color:"{color}",description:{json.dumps("Cobertura publicada desde "+canonical+".",ensure_ascii=False)},source:"{canonical}"}}')
  report.append({'gpkg':canonical,'table':table,'records':count,'fields_web':len(keys),'removed_sensitive':removed})
 con.close()
 manifests[prefix]=manifest; layer_defs[prefix]=defs
 mp=outdir/f'manifest_{canonical[:-5].lower()}.json'
 mp.write_text(json.dumps({'file':canonical,'total':len(manifest),'items':manifest},ensure_ascii=False,indent=2),encoding='utf-8')
 print(canonical,'capas',len(rows))

s=PAGE.read_text(encoding='utf-8')
main_defs=layer_defs['02']+layer_defs['03']+layer_defs['04']
miss_defs=layer_defs['01']+layer_defs['05']
start='/* GENERATED_VF_LAYERS_START */'; end='/* GENERATED_VF_LAYERS_END */'
block=start+'\n'+',\n'.join(main_defs)+'\n '+end
if start not in s or end not in s: raise RuntimeError('Faltan marcadores GENERATED_VF_LAYERS')
s=re.sub(re.escape(start)+r'.*?'+re.escape(end),block,s,flags=re.S)
ms='/* GENERATED_MISSING_DIMS_START */'; me='/* GENERATED_MISSING_DIMS_END */'
mblock=ms+'\n'+',\n'.join(miss_defs)+'\n '+me
if ms in s and me in s:
 s=re.sub(re.escape(ms)+r'.*?'+re.escape(me),mblock,s,flags=re.S)
else:
 pos=s.find('\n];',s.find('const layers:Layer[]=['))
 if pos<0: raise RuntimeError('No se encontró cierre de layers')
 s=s[:pos]+',\n '+mblock+s[pos:]
s=re.sub(r'\{id:"bibliotecas",name:"Bibliotecas 2025".*?\},',
 '{id:"bibliotecas",name:"Bibliotecas 2025",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/sociocultural/soc-pto-bibliotecas-vf-2025.geojson`,color:"#2877a6",description:"Bibliotecas 2025 · cobertura vigente de 21 registros.",source:"03_DIM_SOCIOCULTURAL_VF.gpkg"},',s,count=1,flags=re.S)
PAGE.write_text(s,encoding='utf-8')

cat=json.loads(CAT.read_text(encoding='utf-8'))
containers={x[1] for x in CFG}|{'05_DIM_ADMINISTRATIVA_VF.gpkg','01-DIM_URBANA_VF.gpkg'}
base=[]
for i in cat.get('items',[]):
 c=str(i.get('contenedor',''))
 n=norm(i.get('nombre',''))
 if c in containers: continue
 if 'biblioteca' in n and ('7' in str(i.get('registros','')) or i.get('mapId')=='bibliotecas'): continue
 base.append(i)
for it in all_items:
 base.append({'id':it['id'],'mapId':it['mapId'],'tema':it['theme'],'dimensionPladeco':it['dimension'],'sector':it['sector'],'nombre':friendly(it['table']),'carpeta':it['container'][:-5],'geometria':geomlabel(it['geometry']),'escala':'Comuna','contenedor':it['container'],'tipoContenedor':'GeoPackage VF','subcapa':it['table'],'campoClave':'','estado':'PUBLICADA','validacion':'VALIDADA PARA VISUALIZACIÓN','registros':it['web_records'],'registrosFuente':it['records'],'crs':f'EPSG:{it["source_srid"]} (fuente) / EPSG:4326 (web)','verEnMapa':True,'download':it['geojson'],'observaciones':'Resincronizada desde GeoPackage VF sanitizado; campos sensibles eliminados en fuente no se republican.'})
cat['items']=base; cat['total']=len(base); cat['generatedAt']='2026-09-03'; cat['generatedFrom']='GeoPackage VF sanitizados 01-05'
CAT.write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

old=ROOT/'public/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson'
if old.exists(): old.unlink()
Path('/tmp/resync_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('\nRESYNC OK capas=',len(all_items),'catalogo=',cat['total'])
for x in report:
 if x['removed_sensitive']: print('PRIVACIDAD',x['table'],'omitidos web:',','.join(x['removed_sensitive']))
