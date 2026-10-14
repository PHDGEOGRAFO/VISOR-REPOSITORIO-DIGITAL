// One policy for fields shown in maps, tables and classifications.
const personal=["rut","run","dni","email","correo","mail","telefono","fono","celular","contacto","responsable","encargado","propietario","titular","dueno","apellido","persona","beneficiario","contribuyente","representante","solicitante","paciente","alumno","vecino","nacimiento","fecha_nac","clave","password","contrasena"];
const addresses=["direccion","domicilio","calle","address","ubicacion","numeracion","nro_dom","numero_dom","dir_particular"];
const freeText=["observacion","comentario","descripcion","detalle","nota","notes"];
const publicNames=["barrio","territorio","comuna","sector","establecimiento","equipamiento","recinto","parque","plaza","biblioteca","institucion","organizacion","servicio","especie","escuela","colegio","centro"];
const norm=(v:string)=>v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_");
export function sensitiveAttribute(key:string){
 const n=norm(key),tokens=n.split("_");
 if(personal.some(v=>n.includes(v))||addresses.some(v=>n.includes(v))||tokens.includes("dir")||freeText.some(v=>n.includes(v)))return true;
 if(/(?:^|_)(?:nombre|nombres|name|names|nom)(?:_|$)/.test(n))return !publicNames.some(v=>n.includes(v));
 return false;
}
const rutPattern=/^(?:\d{1,2}(?:\.\d{3}){2}|\d{7,8})-[\dkK]$/;
export function sanitizePublicProperties(input:Record<string,any>):Record<string,any>{
 const cleanValue=(v:any):any=>{if(typeof v==="string"&&rutPattern.test(v.trim()))return null;if(Array.isArray(v))return v.map(cleanValue);if(v&&typeof v==="object")return sanitizePublicProperties(v);return v};
 return Object.fromEntries(Object.entries(input).filter(([key])=>!sensitiveAttribute(key)).map(([key,value])=>[key,cleanValue(value)]));
}
