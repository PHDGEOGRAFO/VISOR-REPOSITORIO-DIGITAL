from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'app/page.tsx'
s=p.read_text(encoding='utf-8')

old='function gpkgDownload(i:IndexItem){const c=String(i.contenedor||"");return c.endsWith("_VF.gpkg")?`/data/gpkg/${c}`:""}'
new='''function gpkgDownload(i:IndexItem){
 const c=String(i.contenedor||"");
 if(c.toLowerCase().endsWith("_vf.gpkg"))return `/data/gpkg/${c}`;
 const d=normFieldName(`${itemDimension(i)} ${i.tema||""} ${i.carpeta||""}`);
 if(d.includes("urbana")||d.includes("urb"))return "/data/gpkg/01_DIM_URBANA_VF.gpkg";
 if(d.includes("ambiental")||d.includes("amb"))return "/data/gpkg/02_DIM_AMBIENTAL_VF.gpkg";
 if(d.includes("sociocultural")||d.includes("soc"))return "/data/gpkg/03_DIM_SOCIOCULTURAL_VF.gpkg";
 if(d.includes("economica")||d.includes("eco"))return "/data/gpkg/04_DIM_ECONOMICA_VF.gpkg";
 if(d.includes("institucional")||d.includes("administrativa")||d.includes("ins")||d.includes("adm"))return "/data/gpkg/05_DIM_ADMINISTRATIVA_VF.gpkg";
 return ""
}'''
if old in s:
    s=s.replace(old,new,1)
elif 'function gpkgDownload(i:IndexItem)' not in s:
    raise SystemExit('No existe gpkgDownload')

old_hints='const PUBLIC_FIELD_HINTS=["direccion","domicilio","calle","ubicacion","address","nombre","nom","tipo","tipologia","categoria","clase","subtipo","sector","rubro","actividad","uso","destino","estado","condicion","modalidad","especie","grupo","tramo","ruta","servicio","equipamiento","recinto","barrio","territorio","comuna","zona","codigo","descripcion"];'
new_hints='const PUBLIC_FIELD_HINTS=["direccion","domicilio","calle","ubicacion","address","nombre","nom","tipo","tipologia","categoria","clase","subtipo","sector","rango","range","tramo","nivel","estrato","quintil","decil","percentil","segmento","grupo","agrp","agrupacion","rubro","actividad","uso","destino","estado","condicion","modalidad","especie","ruta","servicio","equipamiento","recinto","barrio","territorio","comuna","zona","codigo","descripcion"];'
if old_hints in s:
    s=s.replace(old_hints,new_hints,1)
elif '"rango"' not in s:
    raise SystemExit('No se pudo ampliar PUBLIC_FIELD_HINTS')

s=s.replace(
    'Solo se ofrecen campos descriptivos no sensibles (dirección, nombre, tipo/tipología u otro diferenciador seguro). Manzanas censales y coberturas SII quedan exceptuadas de este filtro.',
    'Solo se ofrecen campos descriptivos no sensibles: dirección, nombre, tipo/tipología, rango o equivalentes (grupo, sector, tramo, nivel, estrato, quintil, decil, segmento). Manzanas censales y coberturas SII quedan exceptuadas de este filtro.'
)
p.write_text(s,encoding='utf-8')

# Hover de puntos: prioriza nombre/descriptores públicos y excluye campos sensibles.
im=ROOT/'app/InteractiveMap.tsx'
t=im.read_text(encoding='utf-8')
old_fn='function featureName(f:GeoFeature){const p=f.properties||{};return String(p.NOMBRE??p.NOM_BARRIO??p.NOM_TERR??p.SECTORES_T??p.BARRIO??p.TERRITORIO??p.COD_MZN??p.cod_mzn??p.EXPROP_ID??"Elemento")}'
new_fn='''function featureName(f:GeoFeature){const p=f.properties||{};const keys=Object.keys(p);const norm=(v:string)=>v.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"_");const sensitive=["rut","run","correo","email","mail","telefono","fono","celular","contacto","responsable","propietario","titular","apellido"];const safe=(k:string)=>!sensitive.some(x=>norm(k).includes(x));const preferred=["nombre","name","nom","denominacion","establecimiento","equipamiento","recinto","direccion","domicilio","calle","tipo","tipologia","categoria","barrio","territorio","comuna"];for(const hint of preferred){const k=keys.find(k=>safe(k)&&(norm(k)===hint||norm(k).startsWith(hint+"_")||norm(k).endsWith("_"+hint)));if(k&&p[k]!=null&&String(p[k]).trim())return String(p[k])}return String(p.COD_MZN??p.cod_mzn??"Elemento") }'''
if old_fn in t:
    t=t.replace(old_fn,new_fn,1)
elif 'const sensitive=[' not in t:
    raise SystemExit('No se pudo actualizar featureName')
im.write_text(t,encoding='utf-8')

css=ROOT/'app/globals.css'
c=css.read_text(encoding='utf-8')
marker='/* Control de descargas VF y columna de acciones */'
if marker not in c:
    c += '''\n\n/* Control de descargas VF y columna de acciones */
.coverageIndex th:last-child,.coverageIndex td:last-child{position:sticky;right:0;z-index:2;background:#fffefa;min-width:225px;box-shadow:-4px 0 8px #102c2712}.coverageIndex th:last-child{z-index:4;background:#173f38;color:#fff}.indexActions{min-width:205px}.indexActions .downloadAction{display:inline-flex!important;align-items:center;justify-content:center;min-width:82px;font-weight:700}.indexActions .downloadAction:before{content:"↓ ";font-weight:900}
'''
    css.write_text(c,encoding='utf-8')

cat=json.loads((ROOT/'public/catalog/index_coberturas.json').read_text(encoding='utf-8'))
vf=[i for i in cat['items'] if str(i.get('tipoContenedor','')).lower().startswith('geopackage vf')]
missing_geo=[i['id'] for i in vf if not i.get('download')]
if missing_geo:
    raise SystemExit('VF sin GeoJSON: '+', '.join(missing_geo))

dim_counts={}
for i in vf:
    dim=str(i.get('dimensionPladeco',''))
    dim_counts[dim]=dim_counts.get(dim,0)+1
for key in ('AMBIENTAL','SOCIOCULTURAL','ECONOM'):
    if not any(key in d.upper() and n>0 for d,n in dim_counts.items()):
        raise SystemExit('Dimensión VF ausente: '+key)

for fn in ('02_DIM_AMBIENTAL_VF.gpkg','03_DIM_SOCIOCULTURAL_VF.gpkg','04_DIM_ECONOMICA_VF.gpkg'):
    f=ROOT/'public/data/gpkg'/fn
    if not f.exists() or f.stat().st_size==0:
        raise SystemExit('GPKG ausente: '+fn)

rsh=json.loads((ROOT/'public/data/sociocultural/soc-pol-rsh-40-2024.geojson').read_text(encoding='utf-8'))
keys=set((rsh.get('features') or [{}])[0].get('properties',{}).keys())
rsh_fields={'SECTOR_AU','AGRP'}.intersection(keys)
if not rsh_fields:
    raise SystemExit('RSH sin SECTOR_AU/AGRP')

print('OK VF por dimensión:',dim_counts)
print('OK RSH clasificadores:',sorted(rsh_fields))
print('OK descargas GeoJSON para',len(vf),'coberturas VF y GPKG por dimensión')
print('OK hover seguro de puntos con nombre/descriptor público')
