"use client";
import {useEffect} from "react";

export default function MapUiEnhancements(){
 useEffect(()=>{
  let cleanup=()=>{};
  const setup=()=>{
   const map=document.querySelector<HTMLElement>(".map");
   const interactive=document.querySelector<HTMLElement>(".interactiveMap");
   const tools=document.querySelector<HTMLElement>(".analysisTools");
   if(!map||!interactive||!tools)return false;

   let toolbar=map.querySelector<HTMLElement>(".mapNavigationBar");
   if(!toolbar){
    toolbar=document.createElement("div");
    toolbar.className="mapNavigationBar";
    toolbar.setAttribute("aria-label","Navegación del mapa");
    const actions=[
     ["✋","Mover el plano","pan"],
     ["＋","Acercar","zoom-in"],
     ["−","Alejar","zoom-out"],
     ["⌂","Vista inicial","home"]
    ];
    actions.forEach(([label,title,action])=>{
     const b=document.createElement("button");b.type="button";b.textContent=label;b.title=title;b.dataset.action=action;toolbar!.appendChild(b);
    });
    map.appendChild(toolbar);
   }
   const click=(e:Event)=>{
    const b=(e.target as HTMLElement).closest<HTMLButtonElement>("button");if(!b)return;
    const a=b.dataset.action;
    if(a==="zoom-in"||a==="zoom-out")interactive.dispatchEvent(new WheelEvent("wheel",{deltaY:a==="zoom-in"?-120:120,bubbles:true,cancelable:true}));
    if(a==="pan"){interactive.classList.add("panMode");const candidates=[...document.querySelectorAll<HTMLButtonElement>(".selectionButtons button")];const p=candidates.find(x=>x.textContent?.toLowerCase().includes("puntos")&&!x.disabled);p?.click();}
    if(a==="home")window.location.hash="";
   };
   toolbar.addEventListener("click",click);

   const header=tools.querySelector<HTMLElement>(":scope > b");
   if(header){header.classList.add("analysisDragHandle");header.title="Arrastrar Herramientas del mapa";}
   let dragging=false,sx=0,sy=0,ox=0,oy=0;
   const down=(e:PointerEvent)=>{if(!header||e.button!==0)return;dragging=true;sx=e.clientX;sy=e.clientY;const r=tools.getBoundingClientRect();ox=r.left;oy=r.top;tools.style.position="fixed";tools.style.left=`${ox}px`;tools.style.top=`${oy}px`;tools.style.right="auto";tools.style.bottom="auto";tools.style.zIndex="220";header.setPointerCapture?.(e.pointerId);e.preventDefault()};
   const move=(e:PointerEvent)=>{if(!dragging)return;const maxX=Math.max(0,window.innerWidth-tools.offsetWidth),maxY=Math.max(0,window.innerHeight-tools.offsetHeight);tools.style.left=`${Math.max(0,Math.min(maxX,ox+e.clientX-sx))}px`;tools.style.top=`${Math.max(0,Math.min(maxY,oy+e.clientY-sy))}px`};
   const up=()=>{dragging=false};
   header?.addEventListener("pointerdown",down);window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
   cleanup=()=>{toolbar?.removeEventListener("click",click);header?.removeEventListener("pointerdown",down);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)};
   return true;
  };
  if(setup())return cleanup;
  const obs=new MutationObserver(()=>{if(setup())obs.disconnect()});obs.observe(document.body,{childList:true,subtree:true});
  return()=>{obs.disconnect();cleanup()};
 },[]);
 return null;
}
