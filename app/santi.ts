export type SantiAction=
 |{type:"activate_layer";layerId:string}
 |{type:"set_viz";mode:"simple"|"cluster"|"heat"|"draw"}
 |{type:"message"};

export type SantiContext={
 layerIds:string[];
 active:string[];
 selectedId:string;
 selectedCount:number;
 selectedNperSum:number;
 polygonCount:number|null;
};

const norm=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s_]/g," ").replace(/\s+/g," ").trim();

export function runSanti(query:string,ctx:SantiContext){
 const q=norm(query);
 const actions:SantiAction[]=[];
 if(/lineas oficiales|expropiacion/.test(q)){actions.push({type:"activate_layer",layerId:"lineas-prc"});return{summary:"Activo Líneas Oficiales PRC usando solo la cobertura lineal de expropiación.",actions};}
 if(/grifos?/.test(q)){actions.push({type:"activate_layer",layerId:"grifos"});return{summary:"Activo la cobertura de grifos.",actions};}
 if(/bibliotecas?/.test(q)){actions.push({type:"activate_layer",layerId:"bibliotecas"});return{summary:"Activo Bibliotecas 2025.",actions};}
 if(/manzanas?|censo 2024|n_per|poblacion/.test(q)){actions.push({type:"activate_layer",layerId:"manzana"});if(/cuant|total|suma/.test(q))return{summary:`La selección actual de manzanas suma ${ctx.selectedNperSum.toLocaleString("es-CL")} personas en n_per.`,actions};return{summary:"Activo Manzanas Censo 2024. COD_MZN es la llave y n_per la población operativa.",actions};}
 if(/cluster|clúster/.test(query.toLowerCase())){actions.push({type:"set_viz",mode:"cluster"});return{summary:"Activo visualización Clúster.",actions};}
 if(/calor|heat/.test(q)){actions.push({type:"set_viz",mode:"heat"});return{summary:"Activo mapa de calor.",actions};}
 if(/dibuj|poligono|area de consulta/.test(q)){actions.push({type:"set_viz",mode:"draw"});return{summary:ctx.polygonCount===null?"Activo la herramienta Polígono. Dibuja el área de consulta sobre el mapa.":`El polígono actual contiene ${ctx.polygonCount.toLocaleString("es-CL")} elementos de la capa seleccionada.`,actions};}
 if(/cuantos|cantidad|registros/.test(q))return{summary:`La capa seleccionada contiene ${ctx.selectedCount.toLocaleString("es-CL")} registros cargados.`,actions};
 return{summary:"Puedo activar capas y herramientas del mapa. Prueba: «mostrar grifos», «activar líneas oficiales», «mapa de calor», «dibujar polígono» o «total población n_per».",actions};
}
