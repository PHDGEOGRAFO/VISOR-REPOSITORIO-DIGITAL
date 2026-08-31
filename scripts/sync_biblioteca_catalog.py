from __future__ import annotations
import json, os, re, sys
from pathlib import Path
import pandas as pd
import requests

FILE_ID=os.getenv('BIBLIOTECA_CONTROL_FILE_ID','1yDL59OYZurxeh17lCDrjtyDBl3ZMUsx4')
URL=os.getenv('BIBLIOTECA_CONTROL_URL',f'https://drive.usercontent.google.com/download?id={FILE_ID}&export=download&confirm=t')
OUT=Path('public/catalog/index_coberturas.json')
XLSX=Path('/tmp/CONTROL_COBERTURAS_BIBLIOTECA_DIGITAL.xlsx')

r=requests.get(URL,timeout=90,allow_redirects=True)
r.raise_for_status()
if len(r.content)<10000 or b'<html' in r.content[:500].lower():
    raise RuntimeError('El control de Biblioteca Digital no está disponible como XLSX para el runner. Configure BIBLIOTECA_CONTROL_URL con una URL descargable o credenciales de servicio.')
XLSX.write_bytes(r.content)

df=pd.read_excel(XLSX,sheet_name='Registro Maestro')

def c(v):
    if pd.isna(v): return ''
    if isinstance(v,pd.Timestamp): return v.strftime('%Y-%m-%d')
    if isinstance(v,float) and v.is_integer(): return int(v)
    return v if isinstance(v,(int,float)) else str(v).strip()

def tema(row):
    n=str(row.get('Nombre de cobertura','')).upper(); a=str(row.get('Área/Dimensión','')).upper(); t=str(row.get('Temática','')).upper(); s=' '.join((n,a,t))
    if n.startswith('AMB_') or any(x in s for x in ('ARBOL','AMBIENT','VEGETAL','RESIDU','RECICL','RUIDO','AIRE')): return 'AMB'
    if n.startswith('MOV_') or any(x in s for x in ('TRANSP','MOVIL','VIAL','METRO','CICLO','PARADER')): return 'MOV'
    if n.startswith('SEG_') or any(x in s for x in ('SEGUR','GRIFO','BOMBER','CARABIN','CAMARA')): return 'SEG'
    if n.startswith('SAL_') or any(x in s for x in ('SALUD','CESFAM','FARMAC')): return 'SAL'
    if n.startswith('ECO_') or any(x in s for x in ('ECON','COMERC','PATENTE','SII','AIRBNB','TUR_')): return 'ECO'
    if n.startswith('SOC_') or any(x in s for x in ('SOCIAL','CULTUR','BIBLIOT','EDUC','DEPORTE')): return 'SOC'
    return 'URB'

def web_binding(nombre):
    u=nombre.upper()
    if 'CANTIDAD_POBLACION' in u: return 'manzana','/data/manzanas.geojson'
    if 'PRC_EXPROPIACION' in u and 'POLIG' not in u: return 'lineas-prc','/data/prc_expropiacion_lineas.geojson'
    if 'GRIFO' in u: return 'grifos','/data/grifos.geojson'
    if 'BIBLIOTECA' in u and ('PTO' in u or 'PUNTO' in u): return 'bibliotecas','/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson'
    return None,''

items=[]
for _,row in df.iterrows():
    nombre=str(c(row.get('Nombre de cobertura','')))
    map_id,download=web_binding(nombre)
    carpeta=str(c(row.get('Carpeta','')))
    formato=str(c(row.get('Formato','')))
    estado_rev=str(c(row.get('Estado de revisión','')) or 'PENDIENTE')
    estado_visor=str(c(row.get('Estado para Repositorio Visor Digital','')) or c(row.get('Estado','')) or 'PENDIENTE')
    item={
      'id':f"bd-{c(row.get('ID correlativo',''))}", 'mapId':map_id, 'tema':tema(row),
      'nombre':nombre, 'carpeta':carpeta, 'geometria':str(c(row.get('Geometría','')) or 'PENDIENTE'),
      'escala':str(c(row.get('Ámbito','')) or 'Por definir'), 'contenedor':str(c(row.get('GPKG','')) or carpeta or 'Biblioteca Digital'),
      'tipoContenedor':'GeoPackage' if c(row.get('GPKG','')) else formato, 'subcapa':nombre,
      'campoClave':'COD_MZN' if str(c(row.get('COD_MZN',''))).upper() in ('SI','SÍ','TRUE','1') else '',
      'estado':estado_visor, 'validacion':estado_rev, 'registros':c(row.get('Número de registros','')),
      'crs':c(row.get('CRS','')), 'anio':c(row.get('Año o fecha de la información','')),
      'areaDimension':c(row.get('Área/Dimensión','')), 'tematica':c(row.get('Temática','')),
      'rutaOrigen':c(row.get('Ruta completa','')), 'rutaDefinitiva':c(row.get('Ruta definitiva','')),
      'observaciones':c(row.get('Observaciones','')), 'verEnMapa':bool(map_id), 'download':download
    }
    items.append(item)

payload={'schemaVersion':'2.0','source':'2. BIBLIOTECA DIGITAL / CONTROL_COBERTURAS_BIBLIOTECA_DIGITAL.xlsx','total':len(items),'items':items}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'Índice generado: {len(items)} coberturas -> {OUT}')
