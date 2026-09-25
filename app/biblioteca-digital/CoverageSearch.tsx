"use client";

import {useEffect,useMemo,useState} from "react";
import styles from "./biblioteca.module.css";

const BASE_PATH="/VISOR-REPOSITORIO-DIGITAL";

type GlossaryTerm={termino:string;definicion:string};

type CatalogItem={
  id:string;
  nombre:string;
  tema?:string;
  dimensionPladeco?:string;
  sector?:string;
  carpeta?:string;
  geometria?:string;
  escala?:string;
  contenedor?:string;
  tipoContenedor?:string;
  subcapa?:string;
  estado?:string;
  validacion?:string;
  registros?:number|string;
  anio?:string|number;
  observaciones?:string;
  verEnMapa?:boolean;
  download?:string;
  fuenteInstitucional?:string;
  fuenteUrl?:string;
  fuenteAnio?:string|number;
  tipoOrigen?:string;
  tipoConexion?:string;
  frecuenciaActualizacion?:string;
  ultimaActualizacion?:string;
  estadoConexion?:string;
};

const synonyms:Record<string,string[]>= {
  bicicleta:["ciclovia","ciclovias","movilidad"],
  bici:["ciclovia","ciclovias"],
  basura:["residuos","microbasural","aseo","reciclaje"],
  reciclaje:["residuos","puntos limpios","rutas residuos"],
  arbol:["arbolado","vegetacion","ndvi"],
  arboles:["arbolado","vegetacion","ndvi"],
  verde:["areas verdes","plazas","parques","vegetacion","ndvi"],
  seguridad:["grifos","carabineros","pdi","camaras","riesgo"],
  salud:["establecimientos salud","farmacias","salud mental"],
  transporte:["dtpm","metro","movilidad","bus"],
  propiedad:["sii","predios","valor suelo"],
  suelo:["sii","predios","valor suelo","prc"],
};

function norm(v:unknown){return String(v??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}

function expandedQuery(q:string){
  const n=norm(q);
  const terms=new Set(n.split(/\s+/).filter(Boolean));
  [...terms].forEach(t=>(synonyms[t]||[]).forEach(s=>terms.add(norm(s))));
  return [...terms];
}

function searchable(i:CatalogItem){
  return norm([i.nombre,i.tema,i.dimensionPladeco,i.sector,i.carpeta,i.geometria,i.escala,i.contenedor,i.tipoContenedor,i.subcapa,i.estado,i.validacion,i.anio,i.observaciones,i.fuenteInstitucional,i.fuenteAnio,i.tipoOrigen,i.tipoConexion,i.frecuenciaActualizacion,i.ultimaActualizacion,i.estadoConexion].filter(Boolean).join(" "));
}

function score(i:CatalogItem,terms:string[]){
  const name=norm(i.nombre), sector=norm(i.sector), dim=norm(i.dimensionPladeco), all=searchable(i);
  let total=0;
  for(const t of terms){
    if(!t) continue;
    if(name===t) total+=120;
    else if(name.startsWith(t)) total+=80;
    else if(name.includes(t)) total+=60;
    if(sector.includes(t)) total+=24;
    if(dim.includes(t)) total+=18;
    if(all.includes(t)) total+=8;
  }
  return total;
}

export default function CoverageSearch(){
  const [items,setItems]=useState<CatalogItem[]>([]);
  const [query,setQuery]=useState("");
  const [glossary,setGlossary]=useState<GlossaryTerm[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");

  useEffect(()=>{
    Promise.all([
      fetch(`${BASE_PATH}/catalog/index_coberturas.json`,{cache:"no-store"}).then(r=>r.ok?r.json():{items:[]}),
      fetch(`${BASE_PATH}/catalog/conectores_fuentes_oficiales.json`,{cache:"no-store"}).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]}))
    ])
      .then(([catalogo,conectores])=>{
        const base=Array.isArray(catalogo.items)?catalogo.items:[];
        const oficiales=Array.isArray(conectores.items)?conectores.items:[];
        setItems([...base,...oficiales]);
        setStatus("ready");
      })
      .catch(()=>setStatus("error"));
  },[]);

  useEffect(()=>{
    fetch(`${BASE_PATH}/catalog/glosario_fuentes.json`,{cache:"no-store"})
      .then(r=>r.ok?r.json():{terminos:[]})
      .then(j=>setGlossary(Array.isArray(j.terminos)?j.terminos:[]))
      .catch(()=>setGlossary([]));
  },[]);

  const results=useMemo(()=>{
    const terms=expandedQuery(query);
    if(!terms.length)return [];
    return items
      .map(item=>({item,score:score(item,terms)}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||String(a.item.nombre).localeCompare(String(b.item.nombre),"es"))
      .slice(0,8)
      .map(x=>x.item);
  },[items,query]);

  return <section className={styles.coverageSearch} aria-label="Buscador de coberturas GIS">
    <label className={styles.searchLabel} htmlFor="coverage-search">Buscar cobertura GIS</label>
    <div className={styles.searchBox}>
      <span className={styles.searchIcon} aria-hidden="true">⌕</span>
      <input
        id="coverage-search"
        value={query}
        onChange={e=>setQuery(e.target.value)}
        placeholder="Ej.: ciclovías, arbolado, SII, áreas verdes, 2026…"
        autoComplete="off"
      />
      {query&&<button className={styles.clearSearch} onClick={()=>setQuery("")} aria-label="Limpiar búsqueda">×</button>}
    </div>
    <p className={styles.searchHelp}>Busca por nombre, dimensión, temática, año, geometría, GeoPackage, institución o tipo de conexión. El catálogo integra coberturas locales y fuentes oficiales conectables.</p>

    {status==="loading"&&<div className={styles.searchState}>Cargando catálogo de coberturas…</div>}
    {status==="error"&&<div className={styles.searchState}>No fue posible cargar el catálogo en este momento.</div>}

    {glossary.length>0&&<details className={styles.sourceGlossary}>
      <summary>Glosario de fuentes y conectores</summary>
      <div className={styles.glossaryGrid}>
        {glossary.map(g=><div key={g.termino}><strong>{g.termino}</strong><span>{g.definicion}</span></div>)}
      </div>
    </details>}

    {query&&status==="ready"&&<div className={styles.suggestions}>
      <div className={styles.suggestionHeader}><b>{results.length?"Sugerencias":"Sin coincidencias"}</b><span>{items.length} coberturas indexadas</span></div>
      {results.map(i=><article className={styles.suggestionItem} key={i.id}>
        <div className={styles.suggestionMain}>
          <h3>{i.nombre}</h3>
          <p>{(i.dimensionPladeco||"Sin dimensión").replace("DIMENSIÓN ","")} · {i.sector||"Sin temática"}</p>
          <div className={styles.suggestionMeta}>
            {i.geometria&&<span>{i.geometria}</span>}
            {i.anio&&<span>{i.anio}</span>}
            {i.registros!==undefined&&i.registros!==""&&<span>{Number(i.registros).toLocaleString("es-CL")} registros</span>}
            {i.contenedor&&<span>{i.contenedor}</span>}
            {i.fuenteInstitucional&&<span>Fuente: {i.fuenteInstitucional}</span>}
            {(i.fuenteAnio||i.anio)&&<span>Año fuente: {i.fuenteAnio||i.anio}</span>}
            {i.tipoConexion&&<span>Conexión: {i.tipoConexion}</span>}
            {i.estadoConexion&&<span>{i.estadoConexion}</span>}
          </div>
        </div>
        <div className={styles.suggestionActions}>
          <a href={`${BASE_PATH}/`}>Abrir visor</a>
          {i.fuenteUrl&&<a className={styles.sourceLink} href={i.fuenteUrl} target="_blank" rel="noreferrer">Fuente oficial ↗</a>}
          {i.download&&<span className={styles.availableBadge}>Disponible</span>}
        </div>
      </article>)}
    </div>}
  </section>;
}
