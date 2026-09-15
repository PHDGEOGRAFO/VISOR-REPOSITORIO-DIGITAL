"use client";

import {useEffect,useState} from "react";

type DownloadTarget={button:HTMLButtonElement;coverage:string;format:string};
type Config={apiUrl:string;adminEmail:string};
type ApiResult={ok?:boolean;message?:string};

const CONFIG_URL="/VISOR-REPOSITORIO-DIGITAL/download-access-config.json";

export default function DownloadAccessGateV2(){
  const[config,setConfig]=useState<Config>({apiUrl:"",adminEmail:"phernandez@munistgo.cl"});
  const[target,setTarget]=useState<DownloadTarget|null>(null);
  const[email,setEmail]=useState("");
  const[key,setKey]=useState("");
  const[message,setMessage]=useState("");
  const[busy,setBusy]=useState(false);

  useEffect(()=>{
    void fetch(CONFIG_URL,{cache:"no-store"})
      .then(async r=>(r.ok?await r.json():{}) as Partial<Config>)
      .then((value:Partial<Config>)=>setConfig(c=>({...c,...value})))
      .catch(()=>undefined);
  },[]);

  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      const element=event.target instanceof Element?event.target.closest("button.downloadAction"):null;
      if(!(element instanceof HTMLButtonElement))return;
      if(element.dataset.downloadAccessBypass==="1"){
        delete element.dataset.downloadAccessBypass;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const row=element.closest("tr");
      const coverage=(row?.querySelector("td:nth-child(4) strong")?.textContent||"Cobertura territorial").trim();
      setTarget({button:element,coverage,format:(element.textContent||"Archivo").trim()});
      setKey("");
      setMessage("");
    };
    document.addEventListener("click",onClick,true);
    return()=>document.removeEventListener("click",onClick,true);
  },[]);

  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function api(payload:Record<string,string>){
    return new Promise<ApiResult>((resolve,reject)=>{
      if(!config.apiUrl){reject(new Error("Servicio de autorización no disponible."));return;}
      const callback=`__visorDownloadCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const params=new URLSearchParams({...payload,callback,_ts:String(Date.now())});
      const script=document.createElement("script");
      let finished=false;
      const cleanup=()=>{
        if(finished)return;
        finished=true;
        window.clearTimeout(timer);
        script.remove();
        try{delete (window as any)[callback];}catch{(window as any)[callback]=undefined;}
      };
      const timer=window.setTimeout(()=>{
        cleanup();
        reject(new Error("El servicio de autorización tardó demasiado en responder. Intente nuevamente."));
      },15000);
      (window as any)[callback]=(result:ApiResult)=>{
        cleanup();
        if(result?.ok===false)reject(new Error(result.message||"No fue posible completar la operación."));
        else resolve(result||{});
      };
      script.onerror=()=>{
        cleanup();
        reject(new Error("No fue posible conectar con el servicio de autorización."));
      };
      script.src=`${config.apiUrl}?${params.toString()}`;
      script.async=true;
      document.head.appendChild(script);
    });
  }

  async function requestAccess(){
    if(!target||!validEmail){setMessage("Ingrese un correo electrónico válido.");return;}
    setBusy(true);setMessage("");
    try{
      const result=await api({action:"request",email:email.trim().toLowerCase(),coverage:target.coverage,format:target.format});
      setMessage(result.message||"Solicitud enviada. Recibirá un correo cuando su acceso sea autorizado.");
    }catch(error){setMessage(error instanceof Error?error.message:"No fue posible enviar la solicitud.");}
    finally{setBusy(false);}
  }

  function continueDownload(item:DownloadTarget){
    item.button.dataset.downloadAccessBypass="1";
    item.button.click();
    window.setTimeout(()=>{
      const dialog=document.querySelector(".downloadAuthDialog");
      const input=dialog?.querySelector('input[type="password"]');
      const accept=dialog?.querySelector("button.primary");
      if(!(input instanceof HTMLInputElement)||!(accept instanceof HTMLButtonElement))return;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
      if(setter)setter.call(input,"oficina");
      input.dispatchEvent(new Event("input",{bubbles:true}));
      window.setTimeout(()=>accept.click(),40);
    },40);
  }

  async function authorizeDownload(){
    if(!target||!validEmail){setMessage("Ingrese el correo autorizado.");return;}
    if(key.trim().toLowerCase()!=="oficina"){setMessage("Clave incorrecta.");return;}
    const item=target;
    setBusy(true);setMessage("");
    try{
      await api({action:"download",email:email.trim().toLowerCase(),key:key.trim(),coverage:item.coverage,format:item.format});
      setTarget(null);setKey("");
      continueDownload(item);
    }catch(error){setMessage(error instanceof Error?error.message:"Correo no autorizado.");}
    finally{setBusy(false);}
  }

  if(!target)return null;
  return <div className="downloadAccessBackdrop" onClick={()=>{if(!busy)setTarget(null)}}>
    <section className="downloadAccessDialog" onClick={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Acceso a descarga">
      <header><div><small>VISOR TERRITORIAL</small><h2>Acceso a descarga</h2></div><button onClick={()=>setTarget(null)} disabled={busy} aria-label="Cerrar">×</button></header>
      <p className="downloadCoverage"><b>{target.coverage}</b><span>{target.format}</span></p>
      <p>Las descargas requieren un correo previamente autorizado.</p>
      <label>Correo autorizado<input autoFocus type="email" value={email} onChange={event=>{setEmail(event.target.value);setMessage("")}} placeholder="nombre@dominio.cl"/></label>
      <label>Clave<input type="password" value={key} onChange={event=>{setKey(event.target.value);setMessage("")}} placeholder="Clave de descarga"/></label>
      {message&&<p className="downloadAccessMessage">{message}</p>}
      <div className="downloadAccessActions"><button onClick={()=>void requestAccess()} disabled={busy}>Solicitar acceso</button><button className="primary" onClick={()=>void authorizeDownload()} disabled={busy}>{busy?"Validando…":"Descargar"}</button></div>
      <small className="downloadAccessNote">Una vez autorizado, use su correo y la clave <b>oficina</b> en cada descarga. Cada descarga queda registrada.</small>
    </section>
  </div>;
}
