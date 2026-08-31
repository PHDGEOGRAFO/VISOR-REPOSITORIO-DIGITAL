"use client";
import {useEffect,useMemo,useState} from "react";
import InteractiveMap,{GeoCollection,GeoFeature,LayerStyle,VizMode} from "./InteractiveMap";

type Geometry="Punto"|"Línea"|"Polígono";
type Theme="BASE"|"AMB"|"URB"|"MOV"|"SEG"|"SAL"|"ECO"|"SOC";
type Layer={id:string;name:string;theme:Theme;geometry:Geometry;url:string;color:string;description:string;activeDefault?:boolean;populationJoin?:boolean;mapTool?:boolean};
const BASE_PATH="/VISOR-REPOSITORIO-DIGITAL";
const groups:[Theme,string][]=[["BASE","Base territorial"],["AMB","Ambiental"],["URB","Urbana / territorio y suelo"],["MOV","Movilidad y transporte"],["SEG","Seguridad y emergencias"],["SAL","Salud"],["ECO","Económica / actividad comercial"],["SOC","Social / sociocultural"]];
const thematicGroups=groups.filter(([c])=>c!=="BASE");
const layers:Layer[]=[
 {id:"comuna",name:"Límite comunal",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/comuna.geojson`,color:"#173f38",description:"Límite oficial de la comuna.",activeDefault:true},
 {id:"territorio",name:"Territorios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/territorios.geojson`,color:"#356f64",description:"Seis territorios de planificación."},
 {id:"barrio",name:"Barrios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/barrios.geojson`,color:"#35699a",description:"Barrios oficiales."},
 {id:"manzana",name:"Manzanas · Censo 2024",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/manzanas.geojson`,color:"#697671",description:"Base censal de manzanas. COD_MZN es la llave y n_per la población para cálculos.",activeDefault:true,populationJoin:true},
 {id:"lineas-prc",name:"Líneas Oficiales PRC",theme:"URB",geometry:"Línea",url:`${BASE_PATH}/data/prc_expropiacion_lineas.geojson`,color:"#b84c3b",description:"Expropiación PRC representada exclusivamente como líneas. No carga polígonos de expropiación.",mapTool:true},
 {id:"grifos",name:"Grifos",theme:"SEG",geometry:"Punto",url:`${BASE_PATH}/data/grifos.geojson`,color:"#d1533e",description:"Cobertura de grifos publicada en el repositorio."},
 {id:"bibliotecas",name:"Bibliotecas 2025",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson`,color:"#a74235",description:"Localización de bibliotecas comunales."}
];
const styles:Record<string,LayerStyle>={comuna:{color:"#173f38",fill:"#d7e2dc",width:2.4,opacity:.12},territorio:{color:"#17675a",fill:"#4d8d7b",width:1.7,opacity:.08},barrio:{color:"#2865a0",fill:"#2865a0",width:1.1,opacity:.03},manzana:{color:"#697671",fill:"#dfe7e1",width:.45,opacity:.07},"lineas-prc":{color:"#b84c3b",width:1.25,opacity:.95},grifos:{color:"#d1533e",pointRadius:4},bibliotecas:{color:"#a74235",pointRadius:7}};
const empty:GeoCollection={type:"FeatureCollection",features:[]};

export default function Home(){
 const[data,setData]=useState<Record<string,GeoCollection>>({});
 const[active,setActive]=useState<string[]>(layers.filter(l=>l.activeDefault).map(l=>l.id));
 const[selected,setSelected]=useState("manzana");
 const[feature,setFeature]=useState<{f:GeoFeature;layerId:string}|null>(null);
 const[query,setQuery]=useState("");
 const[population,setPopulation]=useState<Record<string,number|null>>({});
 const[status,setStatus]=useState<Record<string,string>>({});
 const[viz,setViz]=useState<VizMode>("simple");
 const[spatialSelection,setSpatialSelection]=useState<GeoFeature[]|null>(null);
 const[analysis,setAnalysis]=useState("Cantidad de registros");
 useEffect(()=>{fetch(`${BASE_PATH}/data/manzanas_poblacion_2024.json`).then(r=>r.ok?r.json():{}).then(setPopulation).catch(()=>setPopulation({}))},[]);
 useEffect(()=>{const needed=new Set([...active,selected]);needed.forEach(id=>{const layer=layers.find(l=>l.id===id);if(!layer)return;if(data[id]&&!(layer.populationJoin&&Object.keys(population).length))return;if(status[id]==="cargando")return;setStatus(s=>({...s,[id]:"cargando"}));fetch(layer.url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then((fc:GeoCollection)=>{if(layer.populationJoin)fc={...fc,features:fc.features.map(f=>{const p={...f.properties},cod=String(p.COD_MZN??p.cod_mzn??"");p.COD_MZN=cod;p.n_per=population[cod]??p.n_per??p.POBLACION??null;return{...f,properties:p}})};setData(d=>({...d,[id]:fc}));setStatus(s=>({...s,[id]:"ok"}))}).catch(()=>setStatus(s=>({...s,[id]:"error"})))});},[active,selected,population]);
 const selectedLayer=layers.find(l=>l.id===selected)!;
 const selectedData=data[selected]??empty;
 const sourceFeatures=spatialSelection??selectedData.features;
 const nperValues=sourceFeatures.map(f=>Number(f.properties.n_per)).filter(Number.isFinite);
 const analysisValue=analysis==="Suma n_per"?nperValues.reduce((a,b)=>a+b,0):analysis==="Promedio n_per"?(nperValues.length?nperValues.reduce((a,b)=>a+b,0)/nperValues.length:0):sourceFeatures.length;
 const thematicLayers=layers.filter(l=>l.theme!=="BASE"&&!l.mapTool);
 const filtered=thematicLayers.filter(l=>(l.name+" "+groups.find(g=>g[0]===l.theme)?.[1]).toLowerCase().includes(query.toLowerCase()));
 const toggle=(id:string)=>setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const setMode=(m:VizMode)=>{setViz(m);if(m!=="draw")setSpatialSelection(null)};
 const printPdf=()=>window.print();
 const props=feature?.f.properties||{};
 const lineasOn=active.includes("lineas-prc");
 return <main>
  <header><div className="logo">MS</div><div className="brand"><small>Municipalidad de Santiago</small><h1>Visor Repositorio Digital</h1><p className="officeLabel">Subdirección de Planificación y Sustentabilidad · Oficina de Planificación</p></div><div className="scope"><span>CAPAS ACTIVAS</span><b>{active.length}</b></div><div className="version"><button onClick={printPdf}>PDF</button></div></header>
  <div className="workspace">
   <aside className="sidebar">
    <div className="catalogHelp"><b>Dimensiones y grupos</b><p>Las capas temáticas se ordenan por dimensión. La base territorial y las herramientas se controlan sobre el mapa.</p></div>
    <label className="search"><b>⌕</b><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cobertura…"/></label>
    <div className="layers">{thematicGroups.map(([code,label])=>{const gl=filtered.filter(l=>l.theme===code);return <section key={code} className="themeSection"><h4><span className="themeCode">{code}</span> {label}<span>{gl.length}</span></h4>{gl.length?gl.map(l=><article key={l.id} className={selected===l.id?"selected":""} onClick={()=>{setSelected(l.id);setSpatialSelection(null)}}><button className={`switch ${active.includes(l.id)?"on":""}`} onClick={e=>{e.stopPropagation();toggle(l.id)}}><span/></button><em style={{background:l.color}}>{l.geometry==="Punto"?"•":"▰"}</em><div><h3>{l.name}</h3><p>{l.geometry} · {status[l.id]==="error"?"error":status[l.id]==="cargando"?"cargando…":"disponible"}</p></div></article>):<small className="emptyGroup">Sin capas publicadas</small>}</section>})}</div>
   </aside>
   <section className="map">
    <InteractiveMap data={data} active={active} styles={styles} selectedLayerId={selected} viz={viz} onSelection={setSpatialSelection} onFeature={(f,layerId)=>{setFeature({f,layerId});setSelected(layerId)}}/>
    <div className="layerControl"><b>Base territorial</b>{layers.filter(l=>l.theme==="BASE").map(l=><label key={l.id}><input type="checkbox" checked={active.includes(l.id)} onChange={()=>toggle(l.id)}/><i className={`key-${l.id}`}/>{l.name}</label>)}<small>Active solo los límites necesarios para mantener una lectura clara.</small></div>
    <div className="analysisTools">
      <b>Herramientas del mapa</b>
      <div className="toolButtons">
       <button className={viz==="simple"?"on":""} onClick={()=>setMode("simple")}>Puntos</button>
       <button className={viz==="cluster"?"on":""} onClick={()=>setMode("cluster")}>Clúster</button>
       <button className={viz==="heat"?"on":""} onClick={()=>setMode("heat")}>Calor</button>
       <button className={viz==="draw"?"on":""} onClick={()=>setMode("draw")}>Polígono</button>
       <button className={lineasOn?"on prc":"prc"} onClick={()=>toggle("lineas-prc")}>Líneas oficiales</button>
      </div>
      <label>Tipo de análisis<select value={analysis} onChange={e=>setAnalysis(e.target.value)}><option>Cantidad de registros</option><option>Suma n_per</option><option>Promedio n_per</option></select></label>
      <p className="analysisResult"><strong>{analysisValue.toLocaleString("es-CL",{maximumFractionDigits:2})}</strong> {analysis}{spatialSelection?` · selección: ${spatialSelection.length}`:""}</p>
    </div>
    <div className="mapmode"><button onClick={printPdf}>Descargar / imprimir PDF</button></div>
   </section>
   <aside className="inspector">
    <p className="kicker">CAPA SELECCIONADA</p><div className="title"><em style={{background:selectedLayer.color}}>{selectedLayer.geometry==="Punto"?"•":selectedLayer.geometry==="Línea"?"╱":"▰"}</em><div><h2>{selectedLayer.name}</h2><p>{groups.find(g=>g[0]===selectedLayer.theme)?.[1]} · {selectedLayer.geometry}</p></div></div>
    <p>{selectedLayer.description}</p>
    <div className="summary"><div><b>{selectedData.features.length.toLocaleString("es-CL")}</b> registros cargados</div>{spatialSelection&&<div><b>{spatialSelection.length.toLocaleString("es-CL")}</b> seleccionados por polígono</div>}</div>
    {feature&&<div className="featureDetails"><p className="kicker">ELEMENTO CONSULTADO</p>{Object.entries(props).slice(0,12).map(([k,v])=><p key={k}><strong>{k}</strong><span>{String(v??"Sin dato")}</span></p>)}</div>}
    <div className="actions"><button className="primary" onClick={printPdf}>Descargar / imprimir PDF</button></div>
   </aside>
  </div>
 </main>
}
