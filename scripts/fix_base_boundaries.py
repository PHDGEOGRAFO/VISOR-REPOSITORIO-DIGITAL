from pathlib import Path

# -----------------------------------------------------------------------------
# Base territorial oficial: usar las coberturas VF sanitizadas y conservar
# geometria completa en Comuna, Territorio y Barrio.
# -----------------------------------------------------------------------------
p = Path("app/page.tsx")
s = p.read_text(encoding="utf-8")

# Reemplazar copias antiguas/paralelas por las coberturas oficiales exportadas
# desde 01_DIM_URBANA_VF.gpkg.
s = s.replace(
    'url:`${BASE_PATH}/data/comuna.geojson`',
    'url:`${BASE_PATH}/data/urbana/limite-comuna.geojson`',
    1,
)
s = s.replace(
    'url:`${BASE_PATH}/data/barrios.geojson`',
    'url:`${BASE_PATH}/data/urbana/limite-barrios.geojson`',
    1,
)
# Territorios ya apunta a limite-territorios-pladeco.geojson; se conserva.
p.write_text(s, encoding="utf-8")

p = Path("app/InteractiveMap.tsx")
s = p.read_text(encoding="utf-8")

# Los limites oficiales base (comuna, territorio y barrio) no deben someterse
# al muestreo/simplificacion que se usa para coberturas tematicas pesadas.
old_patched = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=polygonLayer&&fc.features.length>80;const heavy=polygonHeavy||fc.features.length>600;const layerDetail=polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;'
old_source = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const heavy=fc.features.length>600;const layerDetail=heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;'
new = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const baseExact=id==="comuna"||id==="territorio"||id==="barrio";const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=!baseExact&&polygonLayer&&fc.features.length>80;const heavy=!baseExact&&(polygonHeavy||fc.features.length>600);const layerDetail=baseExact?{parts:100000,points:100000}:polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;const renderFeatures=baseExact?fc.features.filter(f=>visibleFeature(f,zoom,cw.x,cw.y)):viewportFeatures(fc.features,zoom,cw.x,cw.y);'

if old_patched in s:
    s = s.replace(old_patched, new, 1)
elif old_source in s:
    s = s.replace(old_source, new, 1)
elif 'const baseExact=id==="comuna"||id==="territorio"||id==="barrio";' not in s:
    raise RuntimeError("No se encontro el bloque de detalle de capas para corregir limites base")

s = s.replace('viewportFeatures(fc.features,zoom,cw.x,cw.y).map((f,i)=>{', 'renderFeatures.map((f,i)=>{', 1)

p.write_text(s, encoding="utf-8")
print("Base territorial: comuna, territorio y barrio desde fuentes VF oficiales y sin simplificacion.")
