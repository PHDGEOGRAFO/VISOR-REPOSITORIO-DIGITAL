"use client";
import {useEffect,useMemo,useState} from "react";
import InteractiveMap,{DrawPolygon,GeoCollection,GeoFeature,LayerStyle,VizMode} from "./InteractiveMap";
import {analyzePolygon,featuresInPolygon,runSanti} from "./santi";

type Geometry="Punto"|"Línea"|"Polígono";
type Theme="BASE"|"AMB"|"URB"|"MOV"|"SEG"|"SAL"|"ECO"|"SOC";
type Layer={id:string;name:string;theme:Theme;geometry:Geometry;url:string;color:string;description:string;activeDefault?:boolean;populationJoin?:boolean;mapTool?:boolean};
type IndexItem={id:string;tema:string;nombre:string;geometria:string;escala:string;contenedor:string;tipoContenedor:string;subcapa:string;campoClave?:string;campoAnalitico?:string;estado:string;verEnMapa:boolean;download:string};
const BASE_PATH="/VISOR-REPOSITORIO-DIGITAL";
const groups:[Theme,string][]=[["BASE","Base territorial"],["AMB","Ambiental"],["URB","Urbana / territorio y suelo"],["MOV","Movilidad y transporte"],["SEG","Seguridad y emergencias"],["SAL","Salud"],["ECO","Económica / actividad comercial"],["SOC","Social / sociocultural"]];
const thematicGroups=groups.filter(([c])=>c!=="BASE");
const layers:Layer[]=[
 {id:"comuna",name:"Límite comunal",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/comuna.geojson`,color:"#173f38",description:"Límite oficial de la comuna.",activeDefault:true},
 {id:"territorio",name:"Territorios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/territorios.geojson`,color:"#356f64",description:"Seis territorios de planificación."},
 {id:"barrio",name:"Barrios",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/barrios.geojson`,color:"#35699a",description:"Barrios oficiales."},
 {id:"manzana",name:"Manzanas · Censo 2024",theme:"BASE",geometry:"Polígono",url:`${BASE_PATH}/data/manzanas.geojson`,color:"#697671",description:"Base censal de manzanas. COD_MZN es la llave y n_per la población para cálculos.",activeDefault:true,populationJoin:true},
 {id:"lineas-prc",name:"Líneas Oficiales PRC",theme:"URB",geometry:"Línea",url:`${BASE_PATH}/data/prc_expropiacion_lineas.geojson`,color:"#b84c3b",description:"Expropiación PRC representada exclusivamente como líneas. No carga polígonos de expropiación.",mapTool:true},
 {id:"grifos",name:"Grifos",theme:"SEG",geometry:"Punto",url:`${BASE_PATH}/data/grifos.geojson`,color:"#d1533e",description:"Variable temática de seguridad y emergencias."},
 {id:"bibliotecas",name:"Bibliotecas 2025",theme:"SOC",geometry:"Punto",url:`${BASE_PATH}/data/PTO_BIB_2025_001_BIBLIOTECAS_2025.geojson`,color:"#2f7d5b",description:"Variable temática social / sociocultural."}
];
const styles:Record<string,LayerStyle>={comuna:{color:"#173f38",fill:"#d7e2dc",width:2.4,opacity:.12},territorio:{color:"#17675a",fill:"#4d8d7b",width:1.7,opacity:.08},barrio:{color:"#2865a0",fill:"#2865a0",width:1.1,opacity:.03},manzana:{color:"#697671",fill:"#dfe7e1",width:.45,opacity:.07},"lineas-prc":{color:"#b84c3b",width:1.25,opacity:.95},grifos:{color:"#d1533e",pointRadius:4},bibliotecas:{color:"#2f7d5b",pointRadius:7}};
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
 const[polygon,setPolygon]=useState<DrawPolygon|null>(null);
 const[spatialSelection,setSpatialSelection]=useState<GeoFeature[]|null>(null);
 const[analysis,setAnalysis]=useState("Cantidad de registros");
 const[santiQuery,setSantiQuery]=useState("");
 const[santiReply,setSantiReply]=useState("Santi_A conectado. Puedo activar capas, herramientas y consultar áreas dibujadas.");
 const[indexOpen,setIndexOpen]=useState(false);
 const[indexItems,setIndexItems]=useState<IndexItem[]>([]);
 const[indexQuery,setIndexQuery]=useState("");
 const[indexTheme,setIndexTheme]=useState("TODOS");
 useEffect(()=>{fetch(`${BASE_PATH}/data/manzanas_poblacion_2024.json`).then(r=>r.ok?r.json():{}).then(setPopulation).catch(()=>setPopulation({}))},[]);
 useEffect(()=>{fetch(`${BASE_PATH}/catalog/index_coberturas.json`).then(r=>r.ok?r.json():{items:[]}).then(j=>setIndexItems(j.items||[])).catch(()=>setIndexItems([]))},[]);
 useEffect(()=>{const needed=new Set(layers.map(l=>l.id));needed.forEach(id=>{const layer=layers.find(l=>l.id===id);if(!layer)return;if(data[id]&&!(layer.populationJoin&&Object.keys(population).length))return;if(status[id]==="cargando")return;setStatus(s=>({...s,[id]:"cargando"}));fetch(layer.url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then((fc:GeoCollection)=>{if(layer.populationJoin)fc={...fc,features:fc.features.map(f=>{const p={...f.properties},cod=String(p.COD_MZN??p.cod_mzn??"");p.COD_MZN=cod;p.n_per=population[cod]??p.n_per??p.POBLACION??null;return{...f,properties:p}})};setData(d=>({...d,[id]:fc}));setStatus(s=>({...s,[id]:"ok"}))}).catch(()=>setStatus(s=>({...s,[id]:"error"})))});},[population]);
 const selectedLayer=layers.find(l=>l.id===selected)!;
 const selectedData=data[selected]??empty;
 const sourceFeatures=spatialSelection??selectedData.features;
 const nperValues=sourceFeatures.map(f=>Number(f.properties.n_per)).filter(Number.isFinite);
 const nperSum=nperValues.reduce((a,b)=>a+b,0);
 const manzanaPopulationSum=(data.manzana?.features??[]).reduce((s,f)=>s+(Number(f.properties.n_per)||0),0);
 const polygonResults=useMemo(()=>polygon?analyzePolygon(polygon,data,layers.map(l=>({id:l.id,name:l.name}))):null,[polygon,data]);
 const analysisValue=analysis==="Suma n_per"?nperSum:analysis==="Promedio n_per"?(nperValues.length?nperSum/nperValues.length:0):sourceFeatures.length;
 const thematicLayers=layers.filter(l=>l.theme!=="BASE"&&!l.mapTool);
 const filtered=thematicLayers.filter(l=>(l.name+" "+groups.find(g=>g[0]===l.theme)?.[1]).toLowerCase().includes(query.toLowerCase()));
 const indexFiltered=useMemo(()=>indexItems.filter(i=>(indexTheme==="TODOS"||i.tema===indexTheme)&&(`${i.nombre} ${i.contenedor} ${i.subcapa} ${i.geometria} ${i.escala}`).toLowerCase().includes(indexQuery.toLowerCase())),[indexItems,indexTheme,indexQuery]);
 const toggle=(id:string)=>setActive(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const ensureActive=(id:string)=>setActive(a=>a.includes(id)?a:[...a,id]);
 const setMode=(m:VizMode)=>{setViz(m);if(m!=="draw"){setPolygon(null);setSpatialSelection(null)}};
 const handlePolygon=(p:DrawPolygon|null)=>{setPolygon(p);setSpatialSelection(p?featuresInPolygon(data[selected],p):null);if(p)setSantiReply("Polígono recibido. Santi_A puede consultar todas las coberturas, incluso las que están apagadas.")};
 const askSanti=()=>{const r=runSanti(santiQuery,{active,selectedId:selected,selectedCount:selectedData.features.length,manzanaPopulationSum,polygonResults});r.actions.forEach(a=>{if(a.type==="activate_layer"){ensureActive(a.layerId);setSelected(a.layerId);if(polygon)setSpatialSelection(featuresInPolygon(data[a.layerId],polygon))}if(a.type==="set_viz")setMode(a.mode)});setSantiReply(r.summary);};
 const openFromIndex=(id:string)=>{const layer=layers.find(l=>l.id===id);if(!layer)return;ensureActive(id);setSelected(id);setIndexOpen(false)};
 const printPdf=()=>window.print();
 const props=feature?.f.properties||{};
 const lineasOn=active.includes("lineas-prc");
 return <main>
  <header className="institutionalHeader"><div className="municipalBrand"><div className="crest" aria-label="Identificación Municipalidad de Santiago"><span>✦</span><b>STGO</b></div><div><strong>Municipalidad de Santiago</strong><small>Subdirección de Planificación y Sustentabilidad</small><small>Oficina de Planificación</small></div></div><div className="brand"><h1>Visor Territorial</h1><p className="officeLabel">Repositorio Territorial Digital</p></div><nav className="topActions"><button onClick={()=>setIndexOpen(true)}>Índice de Coberturas</button><button onClick={printPdf}>Descargar / imprimir PDF</button></nav><div className="scope"><span>CAPAS ACTIVAS</span><b>{active.length}</b></div></header>
  <div className="workspace">
   <aside className="sidebar">
    <div className="catalogHelp"><b>Dimensiones temáticas</b><p>AMB · URB · MOV · SEG · SAL · ECO · SOC. Los límites se administran exclusivamente junto al mapa.</p></div>
    <label className="search"><b>⌕</b><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cobertura temática…"/></label>
    <div className="layers">{thematicGroups.map(([code,label])=>{const gl=filtered.filter(l=>l.theme===code);return <section key={code} className="themeSection"><h4><span className="themeCode">{code}</span> {label}<span>{gl.length}</span></h4>{gl.length?gl.map(l=><article key={l.id} className={selected===l.id?"selected":""} onClick={()=>{setSelected(l.id);setSpatialSelection(polygon?featuresInPolygon(data[l.id],polygon):null)}}><button className={`switch ${active.includes(l.id)?"on":""}`} onClick={e=>{e.stopPropagation();toggle(l.id)}}><span/></button><em style={{background:l.color}}>{l.geometry==="Punto"?"•":"▰"}</em><div><h3>{l.name}</h3><p>{l.geometry} · {status[l.id]==="error"?"error":status[l.id]==="cargando"?"cargando…":"disponible"}</p></div></article>):<small className="emptyGroup">Sin capas publicadas</small>}</section>})}</div>
   </aside>
   <section className="map">
    <InteractiveMap data={data} active={active} styles={styles} selectedLayerId={selected} viz={viz} onPolygon={handlePolygon} onFeature={(f,layerId)=>{setFeature({f,layerId});setSelected(layerId);setSpatialSelection(polygon?featuresInPolygon(data[layerId],polygon):null)}}/>
    <div className="layerControl"><b>Base territorial</b>{layers.filter(l=>l.theme==="BASE").map(l=><label key={l.id}><input type="checkbox" checked={active.includes(l.id)} onChange={()=>toggle(l.id)}/><i className={`key-${l.id}`}/>{l.name}</label>)}<small>Active solo los límites necesarios para mantener una lectura clara.</small></div>
    <div className="analysisTools"><b>Herramientas del mapa</b><div className="toolButtons"><button className={viz==="simple"?"on":""} onClick={()=>setMode("simple")}>Puntos</button><button className={viz==="cluster"?"on":""} onClick={()=>setMode("cluster")}>Clúster</button><button className={viz==="heat"?"on":""} onClick={()=>setMode("heat")}>Calor</button><button className={viz==="draw"?"on":""} onClick={()=>setMode("draw")}>Polígono</button><button className={lineasOn?"on prc":"prc"} onClick={()=>toggle("lineas-prc")}>Líneas oficiales</button></div><label>Tipo de análisis<select value={analysis} onChange={e=>setAnalysis(e.target.value)}><option>Cantidad de registros</option><option>Suma n_per</option><option>Promedio n_per</option></select></label><p className="analysisResult"><strong>{analysisValue.toLocaleString("es-CL",{maximumFractionDigits:2})}</strong> {analysis}{spatialSelection?` · selección: ${spatialSelection.length}`:""}</p></div>
   </section>
   <aside className="inspector">
    <section className="santiPanel"><div className="santiHead"><b>Santi_A</b><span>Agente Territorial IA · beta</span></div><p>{santiReply}</p><div className="santiAsk"><input value={santiQuery} onChange={e=>setSantiQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")askSanti()}} placeholder="Ej.: ¿qué existe en este polígono?"/><button onClick={askSanti}>Consultar</button></div></section>
    <p className="kicker">CAPA SELECCIONADA</p><div className="title"><em style={{background:selectedLayer.color}}>{selectedLayer.geometry==="Punto"?"•":selectedLayer.geometry==="Línea"?"╱":"▰"}</em><div><h2>{selectedLayer.name}</h2><p>{groups.find(g=>g[0]===selectedLayer.theme)?.[1]} · {selectedLayer.geometry}</p></div></div>
    <p>{selectedLayer.description}</p><div className="summary"><div><b>{selectedData.features.length.toLocaleString("es-CL")}</b> registros cargados</div>{spatialSelection&&<div><b>{spatialSelection.length.toLocaleString("es-CL")}</b> intersectados por polígono</div>}{polygonResults&&<div><b>{polygonResults.length}</b> capas intersectadas por Santi_A</div>}</div>
    {feature&&<div className="featureDetails"><p className="kicker">ELEMENTO CONSULTADO</p>{Object.entries(props).slice(0,12).map(([k,v])=><p key={k}><strong>{k}</strong><span>{String(v??"Sin dato")}</span></p>)}</div>}
   </aside>
  </div>
  {indexOpen&&<div className="indexBackdrop" onClick={()=>setIndexOpen(false)}><section className="coverageIndex" onClick={e=>e.stopPropagation()}><header><div><p>Repositorio Territorial Digital</p><h2>Índice de Coberturas</h2><span>Cada subcapa se registra individualmente, incluso cuando proviene de GDB, GeoPackage u otro contenedor GIS.</span></div><button onClick={()=>setIndexOpen(false)}>×</button></header><div className="indexFilters"><input value={indexQuery} onChange={e=>setIndexQuery(e.target.value)} placeholder="Buscar cobertura, contenedor, subcapa…"/><select value={indexTheme} onChange={e=>setIndexTheme(e.target.value)}><option value="TODOS">Todas las categorías</option><option>BASE</option><option>AMB</option><option>URB</option><option>MOV</option><option>SEG</option><option>SAL</option><option>ECO</option><option>SOC</option></select><b>{indexFiltered.length} coberturas</b></div><div className="indexTableWrap"><table><thead><tr><th>Tema</th><th>Cobertura</th><th>Geometría</th><th>Escala</th><th>Contenedor / origen</th><th>Subcapa</th><th>Campo clave</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{indexFiltered.map(i=><tr key={i.id}><td><span className={`tag tag-${i.tema}`}>{i.tema}</span></td><td><strong>{i.nombre}</strong>{i.campoAnalitico&&<small>Analítico: {i.campoAnalitico}</small>}</td><td>{i.geometria}</td><td>{i.escala}</td><td><strong>{i.tipoContenedor}</strong><small>{i.contenedor}</small></td><td><code>{i.subcapa}</code></td><td><code>{i.campoClave||"—"}</code></td><td><span className="statusOk">{i.estado}</span></td><td><div className="indexActions">{i.verEnMapa&&layers.some(l=>l.id===i.id)&&<button onClick={()=>openFromIndex(i.id)}>Ver en mapa</button>}<a href={`${BASE_PATH}${i.download}`} download>Descargar</a></div></td></tr>)}</tbody></table></div><footer><b>Regla del índice:</b> un GDB/GPKG puede contener muchas coberturas; cada feature class o layer debe aparecer como una fila independiente y descargable.</footer></section></div>}
 </main>
}
