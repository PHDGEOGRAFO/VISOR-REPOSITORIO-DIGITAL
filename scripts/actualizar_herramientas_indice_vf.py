from pathlib import Path
import json, re, subprocess, sys
from datetime import date

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'app/page.tsx'
CAT=ROOT/'public/catalog/index_coberturas.json'
GPKG=ROOT/'public/data/gpkg/02_DIM_AMBIENTAL_VF.gpkg'

REMOVE={
'vf-amb-lin-alcorques-parque-forestal':'AMB_LIN_ALCORQUES_PARQUE_FORESTAL',
'vf-amb-pol-area-libre-humo':'AMB_POL_AREA_LIBRE_HUMO',
'vf-amb-pol-area-silencio':'AMB_POL_AREA_SILENCIO',
'vf-amb-pol-av-ine-siedu17':'AMB_POL_AV_INE_SIEDU17',
'vf-amb-pol-av-prc84':'AMB_POL_AV_PRC84',
'vf-amb-pol-estratos-medios-pf':'AMB_POL_ESTRATOS_MEDIOS_PF',
'vf-amb-pol-fuentes-agua-parque-forestal':'AMB_POL_FUENTES_AGUA_PARQUE_FORESTAL',
'vf-amb-pol-parque-siedu-ine17':'AMB_POL_PARQUE_SIEDU_INE17',
'vf-amb-pol-plazas':'AMB_POL_PLAZAS',
'vf-amb-pol-plazas-siedu-ine17':'AMB_POL_PLAZAS_SIEDU_INE17',
'vf-amb-pol-zonas-manejo-parque-forestal':'AMB_POL_ZONAS_MANEJO_PARQUE_FORESTAL',
'vf-amb-pto-arbolado-catastro-2013':'AMB_PTO_ARBOLADO_CATASTRO_2013',
'vf-amb-pto-arbolado-quinta-normal-2018':'AMB_PTO_ARBOLADO_QUINTA_NORMAL_2018',
'vf-amb-pto-arbolado-suroriente-2019':'AMB_PTO_ARBOLADO_SURORIENTE_2019',
'vf-amb-pto-arbolado-surponiente-2019':'AMB_PTO_ARBOLADO_SURPONIENTE_2019',
'vf-amb-pto-arbustos-pf':'AMB_PTO_ARBUSTOS_PF',
'vf-amb-pto-estratos-altos-pf':'AMB_PTO_ESTRATOS_ALTOS_PF',
'vf-amb-pto-platanos-orientales-pf':'AMB_PTO_PLATANOS_ORIENTALES_PF',
}

# 1) Depurar GPKG Ambiental final.
if not GPKG.exists():
    raise SystemExit(f'No existe {GPKG}')
for layer in REMOVE.values():
    info=subprocess.run(['ogrinfo',str(GPKG),'-ro','-so',layer],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if 'FAILURE:' not in info.stdout and 'ERROR' not in info.stdout:
        drop=subprocess.run(['ogrinfo',str(GPKG),'-sql',f'DROP TABLE "{layer}"'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        if drop.returncode!=0:
            print(drop.stdout)
            raise SystemExit(f'No se pudo eliminar {layer}')

# 2) Depurar GeoJSON derivados.
cat=json.loads(CAT.read_text(encoding='utf-8'))
removed_items=[]
kept=[]
for item in cat.get('items',[]):
    mid=item.get('mapId') or item.get('id')
    if mid in REMOVE:
        removed_items.append(item)
        d=item.get('download','')
        if d.startswith('/data/'):
            p=ROOT/'public'/d.lstrip('/')
            if p.exists(): p.unlink()
    else:
        kept.append(item)
cat['items']=kept
cat['total']=len(kept)
cat['generatedAt']=str(date.today())
cat['observacionesControl']='Índice sincronizado con capas operativas del visor. Se eliminaron 18 coberturas ambientales por instrucción de depuración.'
CAT.write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

# 3) Depurar referencias visuales y estilos del visor.
s=PAGE.read_text(encoding='utf-8')
for mid in REMOVE:
    s='\n'.join(line for line in s.split('\n') if mid not in line)

# 4) Vincular selección del bloque izquierdo con Herramientas del mapa.
s=s.replace('const[selected,setSelected]=useState("grifos");','const[selected,setSelected]=useState("");')
s=s.replace('const selectedLayer=layers.find(l=>l.id===selected)??layers[0],selectedData=data[selected]??empty;',
'''const selectedLayer=layers.find(l=>l.id===selected)??layers.find(l=>active.includes(l.id)&&l.theme!=="BASE"&&!l.mapTool)??layers.find(l=>l.id==="grifos")??layers[0],selectedData=selected?(data[selected]??empty):empty;\n const activeToolLayers=useMemo(()=>layers.filter(l=>l.theme!=="BASE"&&!l.mapTool&&active.includes(l.id)),[active]);''')
s=s.replace('featuresInPolygon(data[selected],p)','featuresInPolygon(data[selected]??empty,p)')
s=s.replace('Cobertura activa para consulta y análisis','Cobertura seleccionada para Herramientas del mapa')
s=s.replace('>{layers.filter(l=>l.theme!=="BASE"&&!l.mapTool).map(l=><option key={l.id} value={l.id}>{l.name} · {l.geometry}</option>)}</select>',
'><option value="" disabled>Seleccione una cobertura activada a la izquierda</option>{activeToolLayers.map(l=><option key={l.id} value={l.id}>{l.name} · {l.geometry}</option>)}</select>')
s=s.replace('{selectedLayer.geometry==="Punto"?"Esta cobertura es la referencia para Puntos / Clúster / Calor y para los análisis disponibles.":"Esta cobertura es la referencia principal para consultas y análisis. Puntos / Clúster / Calor requieren una cobertura de puntos."}',
'{!selected?"Active una cobertura en el bloque izquierdo o en el Índice. Solo las coberturas activadas quedan disponibles para estas herramientas.":selectedLayer.geometry==="Punto"?"Esta cobertura seleccionada es la referencia para Puntos / Clúster / Calor y para los análisis disponibles.":"Esta cobertura seleccionada es la referencia principal para consultas y análisis. Puntos / Clúster / Calor requieren una cobertura de puntos."}')
old='const toggleFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id))return;setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);setSelected(id)};'
new='const toggleFromIndex=(item:IndexItem)=>{const id=item.mapId||item.id;if(!layers.some(l=>l.id===id))return;setActive(a=>{const turningOff=a.includes(id),next=turningOff?a.filter(x=>x!==id):[...a,id];if(turningOff&&selected===id){const alt=layers.find(l=>next.includes(l.id)&&l.theme!=="BASE"&&!l.mapTool);setSelected(alt?.id??"")}else if(!turningOff)setSelected(id);return next})};'
s=s.replace(old,new)
# Evitar que seleccionar puntos opere sin cobertura elegida.
s=s.replace('disabled={selectedLayer.geometry!=="Punto"}','disabled={!selected||selectedLayer.geometry!=="Punto"}')
# Texto de ayuda del bloque izquierdo.
s=s.replace('Escriba una variable o tema. Puede activar varias coberturas sin entrar por dimensión.','Escriba una variable o tema. Las coberturas que active aquí quedan disponibles inmediatamente en Herramientas del mapa.')
PAGE.write_text(s,encoding='utf-8')

# 5) Validaciones mínimas.
text=PAGE.read_text(encoding='utf-8')
for mid in REMOVE:
    if mid in text: raise SystemExit(f'Referencia residual en page.tsx: {mid}')
for mid in REMOVE:
    if any((x.get('mapId') or x.get('id'))==mid for x in cat['items']): raise SystemExit(f'Referencia residual catálogo: {mid}')
if 'activeToolLayers.map' not in text: raise SystemExit('No quedó vínculo activeToolLayers')
if cat['total'] != len(cat['items']): raise SystemExit('Total de catálogo inconsistente')
print(f'OK catálogo: {cat["total"]} coberturas; eliminadas: {len(removed_items)}')
print('OK vínculo izquierda -> Herramientas del mapa')
