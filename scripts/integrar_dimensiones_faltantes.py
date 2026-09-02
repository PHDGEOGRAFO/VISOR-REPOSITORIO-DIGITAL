from pathlib import Path
import json, re, shutil, sqlite3, subprocess, unicodedata, sys

ROOT=Path(__file__).resolve().parents[1]
SRC=Path('/tmp/vf')
PAGE=ROOT/'app/page.tsx'
CATP=ROOT/'public/catalog/index_coberturas.json'

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD',str(s).upper()) if unicodedata.category(c)!='Mn')

def pick(prefix, words):
    if isinstance(words,str): words=(words,)
    c=[]
    for p in SRC.rglob('*.gpkg'):
        n=norm(p.name)
        if n.startswith(prefix) and 'VF' in n and any(w in n for w in words): c.append(p)
    return sorted(c,key=lambda p:p.stat().st_mtime,reverse=True)[0] if c else None

def slug(s):
    s=norm(s).lower().replace('_','-')
    s=re.sub(r'[^a-z0-9-]+','-',s)
    return re.sub(r'-+','-',s).strip('-')

def friendly(s):
    for pref in ('URB_LIN_','URB_POL_','URB_PTO_','ADM_LIN_','ADM_POL_','ADM_PTO_','INS_LIN_','INS_POL_','INS_PTO_'):
        if s.upper().startswith(pref):
            s=s[len(pref):]; break
    return s.replace('_',' ').title().replace('Sii','SII').replace('Prc','PRC').replace('Ine','INE')

def geom_label(g):
    u=(g or '').upper()
    return 'Punto' if 'POINT' in u else ('Línea' if 'LINE' in u else 'Polígono')

cfg=[
 ('01',('URBANA',),'01_DIM_URBANA_VF.gpkg','urbana','URB','DIMENSIÓN URBANA','Planificación urbana y suelo / Movilidad e infraestructura','#315d8a'),
 ('05',('INSTITUCIONAL','ADMINISTRATIVA'),'05_DIM_INSTITUCIONAL_VF.gpkg','institucional','INS','DIMENSIÓN INSTITUCIONAL','Gestión municipal y activos institucionales','#6b5a83'),
]
found=[]; missing=[]
for row in cfg:
    src=pick(row[0],row[1])
    (found if src else missing).append((row,src))

print('VF encontradas:',[str(src.name) for _,src in found])
print('VF faltantes:',[row[2] for row,_ in missing])
if missing:
    Path('/tmp/vf_missing.txt').write_text('\n'.join(row[2] for row,_ in missing),encoding='utf-8')
if not found:
    sys.exit(0)

cat=json.loads(CATP.read_text(encoding='utf-8'))
new_layers=[]; new_items=[]
Path(ROOT/'public/data/gpkg').mkdir(parents=True,exist_ok=True)
for row,src in found:
    prefix,words,canonical,folder,theme,dim,sector,color=row
    cat['items']=[i for i in cat.get('items',[]) if i.get('dimensionPladeco')!=dim]
    dst=ROOT/'public/data/gpkg'/canonical
    shutil.copy2(src,dst)
    outdir=ROOT/'public/data'/folder
    if outdir.exists(): shutil.rmtree(outdir)
    outdir.mkdir(parents=True)
    con=sqlite3.connect(dst)
    rows=con.execute("SELECT c.table_name,g.geometry_type_name,g.srs_id FROM gpkg_contents c JOIN gpkg_geometry_columns g ON c.table_name=g.table_name WHERE c.data_type='features' ORDER BY c.table_name").fetchall()
    if not rows: raise SystemExit(f'{canonical} no contiene capas espaciales')
    for table,gtype,srs in rows:
        count=con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        sid=f"vf-{folder[:3]}-{slug(table)}"; fname=slug(table)+'.geojson'; out=outdir/fname
        subprocess.run(['ogr2ogr','-f','GeoJSON','-t_srs','EPSG:4326',str(out),str(dst),table,'-lco','RFC7946=YES'],check=True)
        valid=len(json.loads(out.read_text(encoding='utf-8')).get('features',[])); name=friendly(table)
        new_layers.append(f' {{id:"{sid}",name:{json.dumps(name,ensure_ascii=False)},theme:"{theme}",geometry:"{geom_label(gtype)}",url:`${{BASE_PATH}}/data/{folder}/{fname}`,color:"{color}",description:{json.dumps("Cobertura publicada desde "+canonical+".",ensure_ascii=False)},source:"{canonical}"}},')
        new_items.append({'id':sid,'mapId':sid,'tema':theme,'dimensionPladeco':dim,'sector':sector,'nombre':name,'carpeta':canonical[:-5],'geometria':geom_label(gtype),'escala':'Comuna','contenedor':canonical,'tipoContenedor':'GeoPackage VF','subcapa':table,'campoClave':'','estado':'PUBLICADA','validacion':'VALIDADA PARA VISUALIZACIÓN','registros':valid,'registrosFuente':count,'crs':f'EPSG:{srs} (fuente) / EPSG:4326 (web)','verEnMapa':True,'download':f'/data/{folder}/{fname}','observaciones':'Carga oficial desde versión final _VF.'})
    con.close()
    print(canonical,'capas:',len(rows))

cat['items'].extend(new_items); cat['total']=len(cat['items']); cat['generatedAt']='2026-09-02'
CATP.write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

s=PAGE.read_text(encoding='utf-8')
s=s.replace('type Theme="BASE"|"AMB"|"URB"|"MOV"|"SEG"|"SAL"|"ECO"|"SOC";', 'type Theme="BASE"|"AMB"|"URB"|"MOV"|"SEG"|"SAL"|"ECO"|"SOC"|"INS";')
if '["INS","Institucional / administrativa"]' not in s:
    s=s.replace('["SEG","Seguridad y emergencias"],["SAL","Salud"],["ECO","Económica / actividad comercial"],["SOC","Social / sociocultural"]','["SEG","Seguridad y emergencias"],["SAL","Salud"],["ECO","Económica / actividad comercial"],["SOC","Social / sociocultural"],["INS","Institucional / administrativa"]')
block='\n /* GENERATED_MISSING_DIMS_START */\n'+'\n'.join(new_layers)+'\n /* GENERATED_MISSING_DIMS_END */\n'
if '/* GENERATED_MISSING_DIMS_START */' in s:
    s=re.sub(r'\n?\s*/\* GENERATED_MISSING_DIMS_START \*/.*?/\* GENERATED_MISSING_DIMS_END \*/\n?',block,s,flags=re.S)
else:
    m=re.search(r'(const layers:Layer\[\]=\[)(.*?)(\n\];)',s,re.S)
    if not m: raise SystemExit('No se encontró arreglo layers')
    left=s[:m.end(2)].rstrip()
    if not left.endswith(','): left+=','
    s=left+block+s[m.end(2):]
PAGE.write_text(s,encoding='utf-8')
print('Integradas:',len(new_items),'capas. Catálogo total:',cat['total'])
