"use client";

import {useEffect} from "react";

type AnyGeometry={type?:string;coordinates?:any;geometries?:AnyGeometry[]};

function normalizeGeometry(g:AnyGeometry|null|undefined):AnyGeometry|null{
 if(!g)return null;
 if(g.type!=="GeometryCollection")return g;
 const items=(g.geometries||[]).filter(Boolean);
 const polygonParts:any[]=[];
 const lineParts:any[]=[];
 const pointParts:any[]=[];
 for(const part of items){
  if(part.type==="Polygon"&&part.coordinates)polygonParts.push(part.coordinates);
  else if(part.type==="MultiPolygon"&&part.coordinates)polygonParts.push(...part.coordinates);
  else if(part.type==="LineString"&&part.coordinates)lineParts.push(part.coordinates);
  else if(part.type==="MultiLineString"&&part.coordinates)lineParts.push(...part.coordinates);
  else if(part.type==="Point"&&part.coordinates)pointParts.push(part.coordinates);
  else if(part.type==="MultiPoint"&&part.coordinates)pointParts.push(...part.coordinates);
 }
 if(polygonParts.length===1)return{type:"Polygon",coordinates:polygonParts[0]};
 if(polygonParts.length>1)return{type:"MultiPolygon",coordinates:polygonParts};
 if(lineParts.length===1)return{type:"LineString",coordinates:lineParts[0]};
 if(lineParts.length>1)return{type:"MultiLineString",coordinates:lineParts};
 if(pointParts.length===1)return{type:"Point",coordinates:pointParts[0]};
 if(pointParts.length>1)return{type:"MultiPoint",coordinates:pointParts};
 return null;
}

function normalizeFeatureCollection(data:any){
 if(!data||data.type!=="FeatureCollection"||!Array.isArray(data.features))return data;
 return{...data,features:data.features.map((f:any)=>{
  const geometry=normalizeGeometry(f?.geometry);
  return geometry?{...f,geometry}:f;
 })};
}

export default function GeoJsonSanitizer(){
 useEffect(()=>{
  const original=window.fetch.bind(window);
  window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
   const response=await original(input,init);
   const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
   const shouldNormalize=/\/data\/barrios\.geojson(?:\?|$)/i.test(url);
   if(!shouldNormalize||!response.ok)return response;
   try{
    const data=await response.clone().json();
    const clean=normalizeFeatureCollection(data);
    const headers=new Headers(response.headers);
    headers.set("content-type","application/geo+json; charset=utf-8");
    return new Response(JSON.stringify(clean),{status:response.status,statusText:response.statusText,headers});
   }catch{return response;}
  };
  return()=>{window.fetch=original;};
 },[]);
 return null;
}
