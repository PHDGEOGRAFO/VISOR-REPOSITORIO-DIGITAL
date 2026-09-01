import type {GeoCollection,GeoFeature} from "./InteractiveMap";

export type SantiAction=
 |{type:"activate_layer";layerId:string}
 |{type:"set_viz";mode:"simple"|"cluster"|"heat"|"draw"}
 |{type:"set_analysis";analysis:string};
export type PolygonResult={id:string;name:string;count:number;nper?:number};
export type SantiContext={
 active:string[];selectedId:string;selectedCount:number;
 counts:{comuna:number;territorio:number;barrio:number;manzana:number;grifos:number;bibliotecas:number};
 manzanaPopulationSum:number;polygonResults:PolygonResult[]|null;barrioNames:string[];territorioNames:string[];
 breakdowns?:{grifosTerritorio?:Record<string,number>;bibliotecasTerritorio?:Record<string,number>;grifosBarrio?:Record<string,number>;bibliotecasBarrio?:Record<string,number>};
 catalogCount?:number;
 namedScope?:{level:string;name:string;counts:Record<string,number>;nper:number}|null;layerNames?:Record<string,string>;
};
const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s_]/g," ").replace(/\s+/g," ").trim();
type PolygonGeometry={type:"Polygon"|"MultiPolygon";coordinates:any};
function bboxCoords(coords:any,b=[Infinity,Infinity,-Infinity,-Infinity]){if(!Array.isArray(coords))return b;if(typeof coords[0]==="number"){b[0]=Math.min(b[0],coords[0]);b[1]=Math.min(b[1],coords[1]);b[2]=Math.max(b[2],coords[0]);b[3]=Math.max(b[3],coords[1]);return b}for(const c of coords)bboxCoords(c,b);return b}
function bbox(g:any){const b=bboxCoords(g?.coordinates);return b.every(Number.isFinite)?b:null}
function bboxHit(a:number[]|null,b:number[]|null){return !!a&&!!b&&!(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3])}
function pointInRing(p:number[],r:number[][]){let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if(a[1]>p[1]!==b[1]>p[1]&&p[0]<((b[0]-a[0])*(p[1]-a[1]))/((b[1]-a[1])||Number.EPSILON)+a[0])hit=!hit}return hit}
function pointInPolygon(p:number[],g:PolygonGeometry):boolean{if(g.type==="MultiPolygon")return g.coordinates.some((poly:any)=>pointInPolygon(p,{type:"Polygon",coordinates:poly}));const[outer,...holes]=g.coordinates;return pointInRing(p,outer)&&!holes.some((h:number[][])=>pointInRing(p,h))}
function orient(a:number[],b:number[],c:number[]){const v=(b[1]-a[1])*(c[0]-b[0])-(b[0]-a[0])*(c[1]-b[1]);return Math.abs(v)<1e-12?0:v>0?1:2}
function onSeg(a:number[],b:number[],c:number[]){return b[0]<=Math.max(a[0],c[0])+1e-12&&b[0]+1e-12>=Math.min(a[0],c[0])&&b[1]<=Math.max(a[1],c[1])+1e-12&&b[1]+1e-12>=Math.min(a[1],c[1])}
function segHit(p1:number[],q1:number[],p2:number[],q2:number[]){const o1=orient(p1,q1,p2),o2=orient(p1,q1,q2),o3=orient(p2,q2,p1),o4=orient(p2,q2,q1);if(o1!==o2&&o3!==o4)return true;return(o1===0&&onSeg(p1,p2,q1))||(o2===0&&onSeg(p1,q2,q1))||(o3===0&&onSeg(p2,p1,q2))||(o4===0&&onSeg(p2,q1,q2))}
function polyEdges(g:any){const polys=g.type==="MultiPolygon"?g.coordinates:[g.coordinates],out:any[]=[];for(const poly of polys)for(const ring of poly)for(let i=1;i<ring.length;i++)out.push([ring[i-1],ring[i]]);return out}
function lineSegs(g:any){const ls=g.type==="MultiLineString"?g.coordinates:[g.coordinates],out:any[]=[];for(const l of ls)for(let i=1;i<l.length;i++)out.push([l[i-1],l[i]]);return out}
export function intersectsPolygon(g:any,p:PolygonGeometry){if(!g||!bboxHit(bbox(g),bbox(p)))return false;if(g.type==="Point")return pointInPolygon(g.coordinates,p);if(g.type==="MultiPoint")return g.coordinates.some((x:number[])=>pointInPolygon(x,p));const pe=polyEdges(p);if(g.type==="LineString"||g.type==="MultiLineString")return lineSegs(g).some(([a,b]:any)=>pointInPolygon(a,p)||pointInPolygon(b,p)||pe.some(([c,d]:any)=>segHit(a,b,c,d)));if(g.type==="Polygon"||g.type==="MultiPolygon"){const ce=polyEdges(g);if(ce.some(([a,b]:any)=>pe.some(([c,d]:any)=>segHit(a,b,c,d))))return true;const cp=g.type==="Polygon"?g.coordinates[0][0]:g.coordinates[0][0][0],qp=p.type==="Polygon"?p.coordinates[0][0]:p.coordinates[0][0][0];return pointInPolygon(cp,p)||pointInPolygon(qp,g)}return false}
export function featuresInPolygon(fc:GeoCollection|undefined,p:PolygonGeometry){return(fc?.features??[]).filter((f:GeoFeature)=>intersectsPolygon(f.geometry,p))}
export function analyzePolygon(p:PolygonGeometry,data:Record<string,GeoCollection>,meta:{id:string;name:string}[]):PolygonResult[]{return meta.map(m=>{const hits=featuresInPolygon(data[m.id],p);const r:PolygonResult={id:m.id,name:m.name,count:hits.length};if(m.id==="manzana")r.nper=hits.reduce((s,f)=>s+(Number(f.properties.n_per)||0),0);return r}).filter(r=>r.count>0).sort((a,b)=>b.count-a.count)}
function breakdownText(title:string,b?:Record<string,number>){if(!b||!Object.keys(b).length)return`${title}: aún no puedo desagregar porque falta cargar la cobertura territorial.`;return`${title}: ${Object.entries(b).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}: ${v.toLocaleString("es-CL")}`).join(" · ")}.`}

export function runSanti(query:string,ctx:SantiContext){
 const q=norm(query),actions:SantiAction[]=[];const isCount=/cuant|numero|cantidad|total/.test(q);
 const asksPolygon=/poligono|seleccion|seleccionad|dentro|area dibujada/.test(q);
 const polygonCount=(id:string)=>ctx.polygonResults?.find(r=>r.id===id)?.count??0;
 const scope=ctx.namedScope;const layerId=Object.entries(ctx.layerNames??{}).find(([id,name])=>q.includes(norm(name))||q.includes(norm(id)))?.[0]??(/grifos?/.test(q)?"grifos":/bibliotecas?/.test(q)?"bibliotecas":null);
 if(scope&&layerId&&isCount){const n=scope.counts[layerId]??0,name=ctx.layerNames?.[layerId]??layerId;return{summary:`${name} en ${scope.level} ${scope.name}: ${n.toLocaleString("es-CL")} registros. Cálculo realizado con el límite espacial real de ${scope.level}.`,actions};}
 if(scope&&/poblacion|n_per|personas/.test(q))return{summary:`Población n_per en ${scope.level} ${scope.name}: ${scope.nper.toLocaleString("es-CL")} personas.`,actions};
 if(/grifos?/.test(q)&&asksPolygon&&isCount){if(!ctx.polygonResults){actions.push({type:"set_viz",mode:"draw"});return{summary:"Primero dibuja o conserva un polígono de selección. Luego contaré únicamente los grifos que intersectan esa selección.",actions};}const n=polygonCount("grifos");return{summary:`En el polígono seleccionado hay ${n.toLocaleString("es-CL")} grifos. El total de la cobertura completa es ${ctx.counts.grifos.toLocaleString("es-CL")}.`,actions};}
 if(/bibliotecas?/.test(q)&&asksPolygon&&isCount){if(!ctx.polygonResults){actions.push({type:"set_viz",mode:"draw"});return{summary:"Primero dibuja o conserva un polígono de selección. Luego contaré únicamente las bibliotecas que intersectan esa selección.",actions};}const n=polygonCount("bibliotecas");return{summary:`En el polígono seleccionado hay ${n.toLocaleString("es-CL")} bibliotecas. El total de la cobertura completa es ${ctx.counts.bibliotecas.toLocaleString("es-CL")}.`,actions};}
 if(/dimensiones? pladeco|cuales.*dimensiones|lista.*dimensiones/.test(q))return{summary:"Las dimensiones PLADECO del visor son Ambiental, Urbana, Sociocultural, Económica e Institucional. Base Territorial es transversal.",actions};
 if(/sectores?|tematicas?/.test(q)&&/pladeco|dimension/.test(q))return{summary:"La navegación usa Dimensión PLADECO → Sector / temática → Cobertura. Seguridad, movilidad, turismo, patrimonio, áreas verdes y residuos son sectores subordinados.",actions};
 if(/coberturas?|capas?/.test(q)&&isCount&&ctx.catalogCount!=null)return{summary:`El Índice de Coberturas contiene ${ctx.catalogCount.toLocaleString("es-CL")} registros provenientes de 2. BIBLIOTECA DIGITAL.`,actions};
 if(/grifos?/.test(q)&&/territorios?/.test(q))return{summary:breakdownText("Grifos por territorio",ctx.breakdowns?.grifosTerritorio),actions};
 if(/bibliotecas?/.test(q)&&/territorios?/.test(q))return{summary:breakdownText("Bibliotecas por territorio",ctx.breakdowns?.bibliotecasTerritorio),actions};
 if(/grifos?/.test(q)&&/barrios?/.test(q))return{summary:breakdownText("Grifos por barrio",ctx.breakdowns?.grifosBarrio),actions};
 if(/bibliotecas?/.test(q)&&/barrios?/.test(q))return{summary:breakdownText("Bibliotecas por barrio",ctx.breakdowns?.bibliotecasBarrio),actions};
 if(/barrios?/.test(q)&&isCount)return{summary:`La cobertura oficial cargada contiene ${ctx.counts.barrio.toLocaleString("es-CL")} barrios.`,actions};
 if(/territorios?/.test(q)&&isCount)return{summary:`La cobertura territorial cargada contiene ${ctx.counts.territorio.toLocaleString("es-CL")} territorios de planificación.`,actions};
 if(/manzanas?/.test(q)&&isCount&&!/poblacion|n_per/.test(q))return{summary:`La base Censo 2024 contiene ${ctx.counts.manzana.toLocaleString("es-CL")} manzanas cargadas.`,actions};
 if(/grifos?/.test(q)&&isCount)return{summary:`La cobertura de grifos contiene ${ctx.counts.grifos.toLocaleString("es-CL")} registros.`,actions};
 if(/bibliotecas?/.test(q)&&isCount)return{summary:`La cobertura de bibliotecas contiene ${ctx.counts.bibliotecas.toLocaleString("es-CL")} registros.`,actions};
 if(/nombres?.*barrios|cuales.*barrios|lista.*barrios/.test(q))return{summary:ctx.barrioNames.length?`Barrios cargados: ${ctx.barrioNames.join(", ")}.`:"La cobertura de barrios aún no está disponible para listar nombres.",actions};
 if(/nombres?.*territorios|cuales.*territorios|lista.*territorios/.test(q))return{summary:ctx.territorioNames.length?`Territorios: ${ctx.territorioNames.join(", ")}.`:"La cobertura de territorios aún no está disponible para listar nombres.",actions};
 if(/lineas oficiales|expropiacion/.test(q)){actions.push({type:"activate_layer",layerId:"lineas-prc"});return{summary:"Activo Líneas Oficiales PRC. Se admiten exclusivamente LineString y MultiLineString; las geometrías poligonales se descartan.",actions};}
 if(/grifos?/.test(q)){actions.push({type:"activate_layer",layerId:"grifos"});return{summary:"Activo Grifos como variable temática. No forma parte de la base territorial predeterminada.",actions};}
 if(/bibliotecas?/.test(q)){actions.push({type:"activate_layer",layerId:"bibliotecas"});return{summary:"Activo Bibliotecas como variable temática. No forma parte de la base territorial predeterminada.",actions};}
 if(/manzanas?|censo 2024|n_per|poblacion/.test(q)){actions.push({type:"activate_layer",layerId:"manzana"});if(isCount||/suma/.test(q))return{summary:`La base de Manzanas Censo 2024 suma ${ctx.manzanaPopulationSum.toLocaleString("es-CL")} personas en n_per.`,actions};return{summary:"Activo Manzanas Censo 2024. COD_MZN es la llave y n_per la población operativa.",actions};}
 if(/cluster/.test(q)){actions.push({type:"set_viz",mode:"cluster"});return{summary:"Activo Clúster. Selecciona una cobertura de puntos en Herramientas del mapa.",actions};}
 if(/calor|heat/.test(q)){actions.push({type:"set_viz",mode:"heat"});return{summary:"Activo Mapa de calor. Selecciona una cobertura de puntos en Herramientas del mapa.",actions};}
 if(/isocrona/.test(q)){actions.push({type:"set_analysis",analysis:"Isócronas"});return{summary:"Activo Isócronas. Selecciona un punto de origen y define modo y tiempo de viaje.",actions};}
 if(/proximidad|buffer/.test(q)){actions.push({type:"set_analysis",analysis:"Proximidad"});return{summary:"Activo análisis de Proximidad. Selecciona un punto y define la distancia máxima.",actions};}
 if(/densidad/.test(q)){actions.push({type:"set_analysis",analysis:"Densidad"});return{summary:"Activo análisis de Densidad para la cobertura de puntos seleccionada.",actions};}
 if(/dibuj|poligono/.test(q)&&!/que existe|dentro|consulta/.test(q)){actions.push({type:"set_viz",mode:"draw"});return{summary:"Activo la herramienta Polígono. Dibuja el área de consulta sobre el mapa.",actions};}
 if(/que existe|dentro.*poligono|en este poligono|consulta.*poligono/.test(q)){if(!ctx.polygonResults){actions.push({type:"set_viz",mode:"draw"});return{summary:"Primero dibuja un polígono. Luego consultaré las coberturas GIS cargadas, incluso las que estén apagadas.",actions};}const total=ctx.polygonResults.reduce((s,r)=>s+r.count,0),pop=ctx.polygonResults.find(r=>r.id==="manzana")?.nper??0,detail=ctx.polygonResults.slice(0,8).map(r=>`${r.name}: ${r.count}`).join(" · ");return{summary:ctx.polygonResults.length?`El polígono intersecta ${ctx.polygonResults.length} capas y ${total.toLocaleString("es-CL")} elementos. ${detail}${pop?` · Población n_per: ${pop.toLocaleString("es-CL")}`:""}.`:"No encontré elementos dentro del polígono.",actions};}
 if(/cuantos|cantidad|registros/.test(q))return{summary:`La capa seleccionada contiene ${ctx.selectedCount.toLocaleString("es-CL")} registros cargados.`,actions};
 return{summary:"Soy SANTI. Puedo consultar el Índice de Coberturas, contar y desagregar variables por territorio o barrio, activar capas, trabajar con Clúster, Calor, Proximidad e Isócronas y analizar un polígono dibujado.",actions};
}
