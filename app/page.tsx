"use client";
import { useEffect, useMemo, useState } from "react";
import InteractiveMap,{GeoCollection,GeoFeature,LayerStyle} from "./InteractiveMap";

type Geometry="Punto"|"Línea"|"Polígono";
type Theme="BASE"|"AMB"|"URB"|"MOV"|"SEG"|"SAL"|"ECO"|"SOC";
type Layer={id:string;name:string;theme:Theme;geometry:Geometry;url:string;color:string;description:string;activeDefault?:boolean;populationJoin?:boolean};
const BASE_PATH="/VISOR-REPOSITORIO-DIGITAL";
const groups:[Theme,string][]=[
 ["BASE","Base territorial"],["AMB","Ambiental"],["URB","Urbana / territorio y suelo"],["MOV","Movilidad y transporte"],["SEG","Seguridad y emergencias"],["SAL","Salud"],["ECO","Económica / actividad comercial"],["SOC","Social / sociocultural"]
];
const layers:Layer[]=[
 {id:"comuna",name:"Límite comunal",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/comuna.geojson`,color:"#173f38",description:"Límite oficial de la comuna.",activeDefault:true},
 {id:"territorio",name:"Territorios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/territorios.geojson`,color:"#356f64",description:"Seis territorios de planificación."},
 {id:"barrio",name:"Barrios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/barrios.geojson`,color:"#35699a",description:"Barrios oficiales."},
 {id:"manzana",name:"Manzanas · Censo 2024",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/manzanas.geojson`,color:"#697671",description:"Base censal de manzanas. COD_MZN es la llave y n_per la población para cálculos.",activeDefault:true,populationJoin:true},
 {id:"lineas-prc",name:"Líneas Oficiales PRC",theme:"URB",geometry:"Línea",url:`${BASE_PATH}/data/prc_expropiacion_lineas.geojson`,color:"#b84c3b",description:"Líneas oficiales del PRC, publicadas desde la cobertura vectorial lineal.",activeDefault:true},
 {id:"grifos",name:"Grifos",theme:"SEG",geometry:"Punto",url:`${BASE_PATH}/data/grifos.geojson`,color:"#d1533e",description:"Cobertura de grifos publicada en el repositorio."},
 {id:"bibliotecas",name:"Bibliotecas 2025",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson`,color:"#a74235",description:"Localización de bibliotecas comunales."}
];
const styles:Record<string,LayerStyle>={
 comuna:{color:"#173f38",fill:"#d7e2dc",width:2.4,opacity:.12},territorio:{color:"#17675a",fill:"#4d8d7b",width:1.7,opacity:.08},barrio:{color:"#2865a0",fill:"#2865a0",width:1.1,opacity:.03},manzana:{color:"#697671",fill:"#dfe7e1",width:.45,opacity:.07},"lineas-prc":{color:"#b84c3b",width:1.2,opacity:.9},grifos:{color:"#d1533e",pointRadius:4},bibliotecas:{color:"#a74235",pointRadius:7}
};
const empty:GeoCollection={type:"FeatureCollection",features:[]};

export default function Home(){
 const [data,setData]=useState<Record<string,GeoCollection>>({});
 const [active,setActive]=useState<string[]>(layers.filter(l=>l.activeDefault).map(l=>l.id));
 const [selected,setSelected]=useState("manzana");
 const [feature,setFeature]=useState<{f:GeoFeature;layerId:string}|null>(null);
 const [query,setQuery]=useState("");
 const [population,setPopulation]=useState<Record<string,number|null>>({});
 const [status,setStatus]=useState<Record<string,string>>({});
 useEffect(()=>{fetch(`${BASE_PATH}/data/manzanas_poblacion_2024.json`).then(r=>r.ok?r.json():{}).then(setPopulation).catch(()=>setPopulation({}))},[]);
 useEffect(()=>{
   const needed=new Set([...active,selected]);
   needed.forEach(id=>{
     const layer=layers.find(l=>l.id===id);if(!layer)return;
     if(data[id]&&!(layer.populationJoin&&Object.keys(population).length))return;
     if(status[id]==="cargando")return;
     setStatus(s=>({...s,[id]:"cargando"}));
     fetch(layer.url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then((fc:GeoCollection)=>{
       if(layer.populationJoin){
         fc={...fc,features:fc.features.map(f=>{const p={...f.properties};const cod=String(p.COD_MZN??p.cod_mzn??"");p.COD_MZN=cod;p.n_per=population[cod]??p.n_per??p.POBLACION??null;return {...f,properties:p}})};
       }
       setData(d=>({...d,[id]:fc}));setStatus(s=>({...s,[id]:"ok"}));
     }).catch(()=>setStatus(s=>({...s,[id]:"error"})));
   });
 },[active,selected,population]);
 const selectedLayer=layers.find(l=>l.id===selected)!;
 const selectedData=data[selected]??empty;
 const nperTotal=useMemo(()=>selected==="manzana"?selectedData.features.reduce((a,f)=>a+(Number(f.properties.n_per)||0),0):0,[selected,selectedData]);
 const filtered=layers.filter(l=>(l.name+" "+groups.find(g=>g[0]===l.theme)?.[1]).toLowerCase().includes(query.toLowerCase()));
 const toggle=(id:string)=>setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const printPdf=()=>window.print();
 const props=feature?.f.properties||{};
 return <main>
  <header><div className="logo">MS</div><div className="brand"><small>Municipalidad de Santiago</small><h1>Visor Repositorio Digital</h1><p className="officeLabel">Subdirección de Planificación y Sustentabilidad · Oficina de Planificación</p></div><div className="scope"><span>CAPAS ACTIVAS</span><b>{active.length}</b></div><div className="version"><button onClick={printPdf}>PDF</button></div></header>
  <div className="workspace">
   <aside className="sidebar">
    <div className="catalogHelp"><b>Dimensiones y grupos</b><p>Las coberturas se organizan por temática y soportan punto, línea y polígono.</p></div>
    <label className="search"><b>⌕</b><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cobertura…"/></label>
    <div className="layers">
      {groups.map(([code,label])=>{const gl=filtered.filter(l=>l.theme===code);return <section key={code} className="themeSection"><h4>{label} <span>{gl.length}</span></h4>{gl.length?gl.map(l=><article key={l.id} className={selected===l.id?"selected":""} onClick={()=>setSelected(l.id)}><button className={`switch ${active.includes(l.id)?"on":""}`} onClick={e=>{e.stopPropagation();toggle(l.id)}}><span/></button><em style={{background:l.color}}>{l.geometry==="Punto"?"•":l.geometry==="Línea"?"╱":"▰"}</em><div><h3>{l.name}</h3><p>{l.geometry} · {status[l.id]==="error"?"error de carga":status[l.id]==="cargando"?"cargando…":"disponible"}</p></div></article>):<small className="emptyGroup">Sin capas publicadas</small>}</section>})}
    </div>
   </aside>
   <section className="map">
    <InteractiveMap data={data} active={active} styles={styles} onFeature={(f,layerId)=>{setFeature({f,layerId});setSelected(layerId)}}/>
    <div className="layerControl"><b>Límites / base</b>{layers.filter(l=>l.theme==="BASE").map(l=><label key={l.id}><input type="checkbox" checked={active.includes(l.id)} onChange={()=>toggle(l.id)}/><i className={`key-${l.id}`}/>{l.name}</label>)}<small>Active solo los límites necesarios para mantener una lectura clara.</small></div>
    <div className="mapmode"><button onClick={printPdf}>Descargar / imprimir PDF</button></div>
   </section>
   <aside className="inspector">
    <p className="kicker">CAPA SELECCIONADA</p><div className="title"><em style={{background:selectedLayer.color}}>{selectedLayer.geometry==="Punto"?"•":selectedLayer.geometry==="Línea"?"╱":"▰"}</em><div><h2>{selectedLayer.name}</h2><p>{groups.find(g=>g[0]===selectedLayer.theme)?.[1]} · {selectedLayer.geometry}</p></div></div>
    <p>{selectedLayer.description}</p>
    <div className="summary"><div><b>{selectedData.features.length.toLocaleString("es-CL")}</b> registros cargados</div>{selected==="manzana"&&<div><b>{nperTotal.toLocaleString("es-CL")}</b> población sumada en <code>n_per</code></div>}</div>
    {feature&&<div className="featureDetails"><p className="kicker">ELEMENTO CONSULTADO</p>{Object.entries(props).slice(0,12).map(([k,v])=><p key={k}><strong>{k}</strong><span>{String(v??"Sin dato")}</span></p>)}</div>}
    <div className="actions"><button className="primary" onClick={printPdf}>Descargar / imprimir PDF</button></div>
   </aside>
  </div>
 </main>
}
