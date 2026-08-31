"use client";
import { useMemo, useRef, useState } from "react";

export type GeoFeature = {
  type?: "Feature";
  geometry: {
    type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  properties: Record<string, any>;
  id?: string | number;
};
export type GeoCollection = { type: "FeatureCollection"; features: GeoFeature[] };
export type LayerStyle = { color: string; fill?: string; width?: number; pointRadius?: number; opacity?: number };

const W = 900, H = 600, TILE = 256;
function world(lon:number, lat:number, z:number){
  const s=TILE*2**z, sin=Math.sin(lat*Math.PI/180);
  return {x:((lon+180)/360)*s,y:(0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*s};
}
function project(p:number[], z:number, cx:number, cy:number){
  const q=world(p[0],p[1],z); return [q.x-cx+W/2,q.y-cy+H/2];
}
function polygonPath(f:GeoFeature,z:number,cx:number,cy:number){
  const polys=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates;
  return polys.map((poly:number[][][])=>poly.map((ring:number[][])=>ring.map((p,i)=>{const [x,y]=project(p,z,cx,cy);return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")+"Z").join(" ")).join(" ");
}
function linePath(f:GeoFeature,z:number,cx:number,cy:number){
  const lines=f.geometry.type==="LineString"?[f.geometry.coordinates]:f.geometry.coordinates;
  return lines.map((line:number[][])=>line.map((p,i)=>{const [x,y]=project(p,z,cx,cy);return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`}).join("")).join(" ");
}
function featureName(f:GeoFeature){
  const p=f.properties||{};
  return String(p.NOMBRE??p.NOM_BARRIO??p.NOM_TERR??p.BARRIO??p.TERRITORIO??p.COD_MZN??p.cod_mzn??p.EXPROP_ID??"Elemento");
}

export default function InteractiveMap({data,active,styles,onFeature}:{data:Record<string,GeoCollection>;active:string[];styles:Record<string,LayerStyle>;onFeature:(f:GeoFeature,layerId:string)=>void}){
  const [center,setCenter]=useState({lon:-70.657,lat:-33.448});
  const [zoom,setZoom]=useState(14);
  const drag=useRef<{x:number;y:number;center:{lon:number;lat:number}}|null>(null);
  const cw=world(center.lon,center.lat,zoom);
  const tiles=useMemo(()=>{
    const minX=Math.floor((cw.x-W/2)/TILE),maxX=Math.floor((cw.x+W/2)/TILE),minY=Math.floor((cw.y-H/2)/TILE),maxY=Math.floor((cw.y+H/2)/TILE),n=2**zoom;
    const out:{x:number;y:number;tx:number;ty:number}[]=[];
    for(let x=minX;x<=maxX;x++) for(let y=minY;y<=maxY;y++) if(y>=0&&y<n) out.push({x,y,tx:x*TILE-cw.x+W/2,ty:y*TILE-cw.y+H/2});
    return out;
  },[cw.x,cw.y,zoom]);
  const move=(e:React.PointerEvent)=>{
    if(!drag.current)return;
    const scale=TILE*2**zoom, dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y,c=world(drag.current.center.lon,drag.current.center.lat,zoom),x=c.x-dx,y=c.y-dy;
    const lon=(x/scale)*360-180,n=Math.PI-(2*Math.PI*y)/scale,lat=(180/Math.PI)*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
    setCenter({lon,lat});
  };
  return <div className="interactiveMap" onWheel={e=>{e.preventDefault();setZoom(z=>Math.max(11,Math.min(18,z+(e.deltaY<0?1:-1))))}} onPointerDown={e=>{if((e.target as Element).closest(".zoomControl"))return;drag.current={x:e.clientX,y:e.clientY,center};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={move} onPointerUp={()=>drag.current=null}>
    <svg viewBox={`0 0 ${W} ${H}`}>
      <g className="osmTiles">{tiles.map(t=><image key={`${zoom}-${t.x}-${t.y}`} href={`https://tile.openstreetmap.org/${zoom}/${((t.x%2**zoom)+2**zoom)%2**zoom}/${t.y}.png`} x={t.tx} y={t.ty} width={TILE} height={TILE}/>)}</g>
      {active.map(id=>{
        const fc=data[id],s=styles[id]||{color:"#333"}; if(!fc)return null;
        return <g key={id} data-layer={id}>
          {fc.features.map((f,i)=>{
            const common={key:i,onClick:(e:any)=>{e.stopPropagation();onFeature(f,id)}};
            if(f.geometry.type==="Point") {const [x,y]=project(f.geometry.coordinates,zoom,cw.x,cw.y);return <circle {...common} cx={x} cy={y} r={s.pointRadius??5} fill={s.color} fillOpacity={s.opacity??.9} stroke="#fff" strokeWidth="1.5"><title>{featureName(f)}</title></circle>}
            if(f.geometry.type==="MultiPoint") return <g key={i}>{f.geometry.coordinates.map((p:number[],j:number)=>{const [x,y]=project(p,zoom,cw.x,cw.y);return <circle key={j} cx={x} cy={y} r={s.pointRadius??4} fill={s.color}/>})}</g>;
            if(f.geometry.type==="LineString"||f.geometry.type==="MultiLineString") return <path {...common} d={linePath(f,zoom,cw.x,cw.y)} fill="none" stroke={s.color} strokeWidth={s.width??1.5} strokeOpacity={s.opacity??.9} vectorEffect="non-scaling-stroke"><title>{featureName(f)}</title></path>;
            return <path {...common} d={polygonPath(f,zoom,cw.x,cw.y)} fill={s.fill??s.color} fillOpacity={s.opacity??.12} stroke={s.color} strokeWidth={s.width??1} vectorEffect="non-scaling-stroke"><title>{featureName(f)}</title></path>;
          })}
        </g>
      })}
    </svg>
    <div className="zoomControl"><button onClick={()=>setZoom(z=>Math.min(18,z+1))}>+</button><b>{zoom}</b><button onClick={()=>setZoom(z=>Math.max(11,z-1))}>−</button></div>
    <div className="mapAttribution">© OpenStreetMap contributors · fondo gris</div>
  </div>
}
