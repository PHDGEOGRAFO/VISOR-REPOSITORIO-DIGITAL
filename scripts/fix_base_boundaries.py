from pathlib import Path

p = Path("app/InteractiveMap.tsx")
s = p.read_text(encoding="utf-8")

# Los límites oficiales base (comuna, territorio y barrio) deben conservar su geometría.
# La simplificación agresiva se mantiene solo para capas temáticas pesadas.
old_patched = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=polygonLayer&&fc.features.length>80;const heavy=polygonHeavy||fc.features.length>600;const layerDetail=polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;'
old_source = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const heavy=fc.features.length>600;const layerDetail=heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;'
new = 'const hideSelectedPoints=id===selectedLayerId&&(viz==="cluster"||viz==="heat");const baseExact=id==="comuna"||id==="territorio"||id==="barrio";const polygonLayer=fc.features.some(f=>f.geometry.type==="Polygon"||f.geometry.type==="MultiPolygon");const polygonHeavy=!baseExact&&polygonLayer&&fc.features.length>80;const heavy=!baseExact&&(polygonHeavy||fc.features.length>600);const layerDetail=baseExact?{parts:100000,points:100000}:polygonHeavy?{parts:Math.min(detail.parts,4),points:Math.min(detail.points,14)}:heavy?{parts:Math.min(detail.parts,12),points:Math.min(detail.points,28)}:detail;const renderFeatures=baseExact?fc.features.filter(f=>visibleFeature(f,zoom,cw.x,cw.y)):viewportFeatures(fc.features,zoom,cw.x,cw.y);'

if old_patched in s:
    s = s.replace(old_patched, new, 1)
elif old_source in s:
    s = s.replace(old_source, new, 1)
elif 'const baseExact=id==="comuna"||id==="territorio"||id==="barrio";' not in s:
    raise RuntimeError("No se encontró el bloque de detalle de capas para corregir límites base")

s = s.replace('viewportFeatures(fc.features,zoom,cw.x,cw.y).map((f,i)=>{', 'renderFeatures.map((f,i)=>{', 1)

p.write_text(s, encoding="utf-8")
print("Límites base corregidos: comuna, territorio y barrio se renderizan sin simplificación agresiva.")
