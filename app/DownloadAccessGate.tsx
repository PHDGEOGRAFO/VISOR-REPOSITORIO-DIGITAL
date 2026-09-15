"use client";

import {useEffect,useRef,useState} from "react";

type Config={apiUrl?:string;adminEmail?:string};
type TargetInfo={button:HTMLButtonElement;coverage:string;format:string};
type ApiResponse={ok?:boolean;authorized?:boolean;message?:string};

const DEFAULT_ADMIN="phernandez@munistgo.cl";
const CONFIG_URL="/VISOR-REPOSITORIO-DIGITAL/download-access-config.json";

export default function DownloadAccessGate(){
 const[config,setConfig]=useState<Config>({adminEmail:DEFAULT_ADMIN,apiUrl:""});
 const[target,setTarget]=useState<TargetInfo|null>(null);
 const[email,setEmail]=useState("");
 const[key,setKey]=useState("");
 const[message,setMessage]=useState("");
 const[busy,setBusy]=useState(false);
 const targetRef=useRef<TargetInfo|null>(null);
 targetRef.current=target;

 useEffect(()=>{fetch(CONFIG_URL,{cache:"no-store"}).then(async r=>(r.ok?await r.json():{}) as Config).then((j:Config)=>setConfig({adminEmail:j.adminEmail||DEFAULT_ADMIN,apiUrl:j.apiUrl||""})).catch(()=>{})},[]);
 useEffect(()=>{
  const handlers=new WeakMap<Element,EventListener>();
  const attach=(el:Element)=>{
   if(handlers.has(el))return;
   const handler:EventListener=(event)=>{
    const btn=el as HTMLButtonElement;
    if(btn.dataset.downloadAccessBypass==="1"){delete btn.dataset.downloadAccessBypass;return}
    event.preventDefault();event.stopPropagation();(event as any).stopImmediatePropagation?.();
    const row=btn.closest("tr");
    const coverage=(row?.querySelector("td:nth-child(4) strong")?.textContent||"Cobertura territorial").trim();
    const format=(btn.textContent||"Archivo").trim();
    setTarget({button:btn,coverage,format});setKey("");setMessage("");
   };
   handlers.set(el,handler);el.addEventListener("click",handler,true);
  };
  const scan=()=>document.querySelectorAll("button.downloadAction").forEach(attach);
  scan();const obs=new MutationObserver(scan);obs.observe(document.body,{childList:true,subtree:true});
  return()=>{obs.disconnect();document.querySelectorAll("button.downloadAction").forEach(el=>{const h=handlers.get(el);if(h)el.removeEventListener("click",h,true)})};
 },[]);

 const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
 const callApi=(payload:Record<string,string>)=>new Promise<ApiResponse>((resolve,reject)=>{
  if(!config.apiUrl){reject(new Error("BACKEND_PENDING"));return}
  const callback=`__visorDownloadCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const params=new URLSearchParams({...payload,callback,_ts:String(Date.now())});
  const script=document.createElement("script");
  let done=false;
  const cleanup=()=>{if(done)return;done=true;window.clearTimeout(timer);script.remove();try{delete (window as any)[callback]}catch{(window as any)[callback]=undefined}};
  const timer=window.setTimeout(()=>{cleanup();reject(new Error("El servicio de autorización tardó demasiado en responder. Intente nuevamente."))},15000);
  (window as any)[callback]=(data:ApiResponse)=>{cleanup();if(data?.ok===false)reject(new Error(data.message||"No fue posible completar la operación"));else resolve(data||{})};
  script.onerror=()=>{cleanup();reject(new Error("No fue posible conectar con el servicio de autorización."))};
  script.src=`${config.apiUrl}?${params.toString()}`;
  script.async=true;
  document.head.appendChild(script);
 });

 const requestAccess=async()=>{
  if(!target||!validEmail(email)){setMessage("Ingrese un correo electrónico válido para solicitar acceso.");return}
  setBusy(true);setMessage("");
  try{
   if(config.apiUrl){await callApi({action:"request",email:email.trim().toLowerCase(),coverage:target.coverage,format:target.format});setMessage("Solicitud enviada. Recibirá un correo cuando su acceso sea autorizado.")}
   else{
    const subject=encodeURIComponent("Solicitud de acceso · Visor Territorial");
    const body=encodeURIComponent(`Solicito autorización para descargar información del Visor Territorial.\n\nCorreo solicitante: ${email.trim()}\nCobertura: ${target.coverage}\nFormato: ${target.format}\n\nSaludos.`);
    window.location.href=`mailto:${config.adminEmail||DEFAULT_ADMIN}?subject=${subject}&body=${body}`;
    setMessage("Se abrió la solicitud dirigida al administrador. El acceso debe ser autorizado antes de descargar.");
   }
  }catch(e:any){setMessage(e?.message==="BACKEND_PENDING"?"El servicio de autorización aún no está conectado. Use “Solicitar acceso”.":e?.message||"No fue posible enviar la solicitud.")}
  finally{setBusy(false)}
 };

 const continueOriginalDownload=()=>{
  const current=targetRef.current;
  if(!current)return;
  const btn=current.button;btn.dataset.downloadAccessBypass="1";btn.click();
  window.setTimeout(()=>{
   const dialog=document.querySelector(".downloadAuthDialog");
   const input=dialog?.querySelector('input[type="password"]') as HTMLInputElement|null;
   const accept=dialog?.querySelector("button.primary") as HTMLButtonElement|null;
   if(!input||!accept)return;
   const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(input,"oficina");input.dispatchEvent(new Event("input",{bubbles:true}));window.setTimeout(()=>accept.click(),30);
  },30);
 };

 const authorizeDownload=async()=>{
  if(!target||!validEmail(email)){setMessage("Ingrese el correo que fue autorizado.");return}
  if(key.trim().toLowerCase()!=="oficina"){setMessage("Clave incorrecta.");return}
  if(!config.apiUrl){setMessage("Este correo todavía no puede validarse automáticamente. Solicite acceso antes de descargar.");return}
  setBusy(true);setMessage("");
  try{
   await callApi({action:"download",email:email.trim().toLowerCase(),key:key.trim(),coverage:target.coverage,format:target.format});
   continueOriginalDownload();setTarget(null);setKey("");
  }catch(e:any){setMessage(e?.message||"Correo no autorizado o acceso no disponible.")}
  finally{setBusy(false)}
 };

 if(!target)return null;
 return <div className="downloadAccessBackdrop" onClick={()=>!busy&&setTarget(null)}>
  <section className="downloadAccessDialog" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Acceso a descarga">
   <header><div><small>VISOR TERRITORIAL</small><h2>Acceso a descarga</h2></div><button onClick={()=>setTarget(null)} disabled={busy} aria-label="Cerrar">×</button></header>
   <p className="downloadCoverage"><b>{target.coverage}</b><span>{target.format}</span></p>
   <p>Las descargas requieren un correo previamente autorizado. Para cada cobertura ingrese su correo y la clave general de descarga.</p>
   <label>Correo autorizado<input autoFocus type="email" value={email} onChange={e=>{setEmail(e.target.value);setMessage("")}} placeholder="nombre@dominio.cl" autoComplete="email"/></label>
   <label>Clave<input type="password" value={key} onChange={e=>{setKey(e.target.value);setMessage("")}} onKeyDown={e=>{if(e.key==="Enter")authorizeDownload()}} placeholder="Clave de descarga"/></label>
   {message&&<p className="downloadAccessMessage" aria-live="polite">{message}</p>}
   <div className="downloadAccessActions"><button onClick={requestAccess} disabled={busy}>Solicitar acceso</button><button className="primary" onClick={authorizeDownload} disabled={busy}>{busy?"Validando…":"Descargar"}</button></div>
   <small className="downloadAccessNote">Una vez autorizado, deberá ingresar su correo y la clave <b>oficina</b> en cada descarga. Cada descarga queda registrada.</small>
  </section>
 </div>;
}
