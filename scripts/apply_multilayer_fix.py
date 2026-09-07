from pathlib import Path
import re

p=Path('app/InteractiveMap.tsx')
s=p.read_text(encoding='utf-8')

if 'MAX_RENDER_FEATURES' not in s:
    s=s.replace(
        'const W=900,H=600,TILE=256;',
        'const W=900,H=600,TILE=256;\nconst MAX_RENDER_FEATURES=2200,MAX_SELECTED_POINTS=6000,MAX_PARTS=140,MAX_POINTS_PER_PART=120;\nfunction sampleArray<T>(arr:T[],max:number){if(arr.length<=max)return arr;const step=Math.ceil(arr.length/max),out:T[]=[];for(let i=0;i<arr.length;i+=step)out.push(arr[i]);if(out[out.length-1]!==arr[arr.length-1])out.push(arr[arr.length-1]);return out}\nfunction renderFeatures(arr:GeoFeature[],max=MAX_RENDER_FEATURES){return sampleArray(arr,max)}'
    )

s=re.sub(
    r'function polygonPath\(f:GeoFeature,z:number,cx:number,cy:number\)\{.*?\}\nfunction linePath',
    '''function polygonPath(f:GeoFeature,z:number,cx:number,cy:number){const polys0=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;const polys=sampleArray(polys0,MAX_PARTS);return polys.map((poly:number[][][])=>sampleArray(poly,12).map((ring:number[][])=>{const pts=sampleArray(ring,MAX_POINTS_PER_PART);return pts.map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")+"Z"}).join(" ")).join(" ")}\nfunction linePath''',
    s,
    count=1,
    flags=re.S
)

s=re.sub(
    r'function linePath\(f:GeoFeature,z:number,cx:number,cy:number\)\{.*?\}\nfunction featureName',
    '''function linePath(f:GeoFeature,z:number,cx:number,cy:number){const lines0=f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates;const lines=sampleArray(lines0,MAX_PARTS);return lines.map((line:number[][])=>sampleArray(line,MAX_POINTS_PER_PART).map((p,i)=>{const[x,y]=project(p,z,cx,cy);return`${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")).join(" ")}\nfunction featureName''',
    s,
    count=1,
    flags=re.S
)

old_sel='const selectedPoints=useMemo(()=>{const fc=selectedLayerId?data[selectedLayerId]:undefined;if(!fc)return[];return fc.features.filter(f=>f.geometry.type==="Point").map((f,i)=>{const[x,y]=project(f.geometry.coordinates,zoom,cw.x,cw.y);return{x,y,f,i}})},[data,selectedLayerId,zoom,cw.x,cw.y]);'
new_sel='const selectedPoints=useMemo(()=>{if(viz==="simple")return[];const fc=selectedLayerId?data[selectedLayerId]:undefined;if(!fc)return[];const pts=sampleArray(fc.features.filter(f=>f.geometry.type==="Point"),MAX_SELECTED_POINTS);return pts.map((f,i)=>{const[x,y]=project(f.geometry.coordinates,zoom,cw.x,cw.y);return{x,y,f,i}})},[data,selectedLayerId,zoom,cw.x,cw.y,viz]);'
s=s.replace(old_sel,new_sel)

old_clusters='const clusters=useMemo(()=>{const out:{x:number;y:number;items:typeof selectedPoints}[]=[];selectedPoints.forEach(p=>{const h=out.find(c=>Math.hypot(c.x-p.x,c.y-p.y)<38);if(h){h.items.push(p);h.x=h.items.reduce((a,v)=>a+v.x,0)/h.items.length;h.y=h.items.reduce((a,v)=>a+v.y,0)/h.items.length}else out.push({x:p.x,y:p.y,items:[p]})});return out},[selectedPoints]);'
new_clusters='const clusters=useMemo(()=>{if(viz!=="cluster")return[] as {x:number;y:number;items:typeof selectedPoints}[];const bins=new Map<string,typeof selectedPoints>();for(const p of selectedPoints){const k=`${Math.floor(p.x/38)}:${Math.floor(p.y/38)}`;const a=bins.get(k);if(a)a.push(p);else bins.set(k,[p])}return [...bins.values()].map(items=>({x:items.reduce((a,v)=>a+v.x,0)/items.length,y:items.reduce((a,v)=>a+v.y,0)/items.length,items}))},[selectedPoints,viz]);'
s=s.replace(old_clusters,new_clusters)

s=s.replace('>{fc.features.map((f,i)=>','>{renderFeatures(fc.features,id===selectedLayerId?3200:MAX_RENDER_FEATURES).map((f,i)=>')
s=s.replace('if(hideSelectedPoints)return <circle {...common} cx={x} cy={y} r={Math.max(10,s.pointRadius??5)} fill="transparent" stroke="transparent" pointerEvents="all"><title>{featureName(f)}</title></circle>;','if(hideSelectedPoints)return null;')
s=s.replace('f.geometry.coordinates.map((p:number[],j:number)=>','sampleArray(f.geometry.coordinates,MAX_SELECTED_POINTS).map((p:number[],j:number)=>')

p.write_text(s,encoding='utf-8')
print('InteractiveMap optimizado para multicapas')
