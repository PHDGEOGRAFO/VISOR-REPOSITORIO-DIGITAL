from pathlib import Path
import re

p=Path('app/InteractiveMap.tsx')
s=p.read_text(encoding='utf-8')

# Objetivo: no eliminar entidades poligonales por presupuesto global.
# La optimización se hace por viewport + simplificación visual adaptativa.
s=re.sub(
    r'const MAX_TOTAL_RENDER_FEATURES=3600,MAX_RENDER_FEATURES=1200,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    'const MAX_RENDER_FEATURES=1800,MAX_SELECTED_POINTS=5000,MAX_PARTS=40,MAX_POINTS_PER_PART=70;',
    s,
    count=1,
)

# Helpers de visibilidad: conservan todas las entidades poligonales que intersectan el viewport.
# En capas puntuales muy densas se mantiene muestreo sólo después del recorte espacial.
helpers='''function coordinateBounds(coords:any,b=[Infinity,Infinity,-Infinity,-Infinity] as number[]){if(Array.isArray(coords)&&coords.length>=2&&typeof coords[0]==="number"&&typeof coords[1]==="number"){const x=coords[0],y=coords[1];if(Number.isFinite(x)&&Number.isFinite(y)){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)}return b}if(Array.isArray(coords))for(const c of coords)coordinateBounds(c,b);return b}\nfunction visibleFeature(f:GeoFeature,z:number,cx:number,cy:number,pad=100){const b=coordinateBounds(f.geometry.coordinates);if(!b.every(Number.isFinite))return true;const a=project([b[0],b[3]],z,cx,cy),d=project([b[2],b[1]],z,cx,cy);const minX=Math.min(a[0],d[0]),maxX=Math.max(a[0],d[0]),minY=Math.min(a[1],d[1]),maxY=Math.max(a[1],d[1]);return maxX>=-pad&&minX<=W+pad&&maxY>=-pad&&minY<=H+pad}\nfunction viewportFeatures(arr:GeoFeature[],z:number,cx:number,cy:number){const visible=arr.filter(f=>visibleFeature(f,z,cx,cy));if(!visible.length)return visible;const pointOnly=visible.every(f=>f.geometry.type==="Point"||f.geometry.type==="MultiPoint");return pointOnly?sampleArray(visible,MAX_RENDER_FEATURES):visible}\nfunction renderDetail(z:number,activeCount:number){const pressure=Math.max(1,Math.sqrt(Math.max(1,activeCount)));const basePoints=z<=12?18:z<=14?36:MAX_POINTS_PER_PART,baseParts=z<=12?12:z<=14?24:MAX_PARTS;return{points:Math.max(10,Math.floor(basePoints/pressure)),parts:Math.max(8,Math.floor(baseParts/pressure))}}'''

if 'function coordinateBounds(' not in s:
    s=s.replace(
        'function project(p:number[],z:number,cx:number,cy:number){const q=world(p[0],p[1],z);return[q.x-cx+W/2,q.y-cy+H/2]}',
        'function project(p:number[],z:number,cx:number,cy:number){const q=world(p[0],p[1],z);return[q.x-cx+W/2,q.y-cy+H/2]}\n'+helpers
    )

# Polygon/MultiPolygon: se simplifican vértices para pantalla, pero no se descartan features visibles.
s=re.sub(
    r'function polygonPath\(f:GeoFeature,z:number,cx:number,cy:number\)\{.*?\}\nfunction linePath',
    '''function polygonPath(f:GeoFeature,z:number,cx:number,cy:number,maxParts=MAX_PARTS,maxPoints=MAX_POINTS_PER_PART){const polys0=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;const polys=sampleArray(polys0,maxParts);return polys.map((poly:number[][][])=>sampleArray(poly,8).map((ring:number[][])=>{const pts=sampleArray(ring,maxPoints);return pts.map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")+"Z"}).join(" ")).join(" ")}\nfunction linePath''',
    s,
    count=1,
    flags=re.S
)
s=re.sub(
    r'function linePath\(f:GeoFeature,z:number,cx:number,cy:number\)\{.*?\}\nfunction featureName',
    '''function linePath(f:GeoFeature,z:number,cx:number,cy:number,maxParts=MAX_PARTS,maxPoints=MAX_POINTS_PER_PART){const lines0=f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates;const lines=sampleArray(lines0,maxParts);return lines.map((line:number[][])=>sampleArray(line,maxPoints).map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")).join(" ")}\nfunction featureName''',
    s,
    count=1,
    flags=re.S
)

# Sustituye el antiguo presupuesto por capa por detalle adaptativo según zoom/cantidad de capas.
s=re.sub(
    r'const drawing=useRef\(false\);const cw=world\(center\.lon,center\.lat,zoom\);const perLayerBudget=.*?;',
    'const drawing=useRef(false);const cw=world(center.lon,center.lat,zoom);const detail=renderDetail(zoom,active.length);',
    s,
    count=1,
)

# Render principal: recorte espacial primero. No muestrea Polygon/MultiPolygon.
s=s.replace(
    'renderFeatures(fc.features,id===selectedLayerId?Math.min(1400,perLayerBudget*2):Math.min(MAX_RENDER_FEATURES,perLayerBudget)).map((f,i)=>',
    'viewportFeatures(fc.features,zoom,cw.x,cw.y).map((f,i)=>'
)

# Si quedó una variante anterior del render, corrígela también.
s=re.sub(
    r'renderFeatures\(fc\.features,[^\)]*\)\.map\(\(f,i\)=>',
    'viewportFeatures(fc.features,zoom,cw.x,cw.y).map((f,i)=>',
    s,
    count=1,
)

# Usa el nivel de detalle adaptativo en líneas y polígonos.
s=s.replace('linePath(f,zoom,cw.x,cw.y)', 'linePath(f,zoom,cw.x,cw.y,detail.parts,detail.points)')
s=s.replace('polygonPath(f,zoom,cw.x,cw.y)', 'polygonPath(f,zoom,cw.x,cw.y,detail.parts,detail.points)')

# Limpieza de helper antiguo si ya no tiene usos.
if 'renderFeatures(' in s and 'function renderFeatures' in s:
    uses=s.count('renderFeatures(')
    if uses==1:
        s=re.sub(r'\nfunction renderFeatures\(arr:GeoFeature\[],max=MAX_RENDER_FEATURES\)\{return sampleArray\(arr,max\)\}', '', s, count=1)

p.write_text(s,encoding='utf-8')
print('InteractiveMap corregido: viewport + simplificacion adaptativa sin descarte de poligonos visibles')
