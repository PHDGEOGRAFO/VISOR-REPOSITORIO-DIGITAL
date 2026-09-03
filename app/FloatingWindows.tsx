"use client";

import {useEffect} from "react";

const SELECTOR=".utilityModal,.downloadAuthDialog";

export default function FloatingWindows(){
 useEffect(()=>{
  const cleanups=new WeakMap<Element,()=>void>();
  const prepare=(el:Element)=>{
   if((el as HTMLElement).dataset.floatingReady==="1")return;
   const box=el as HTMLElement;
   box.dataset.floatingReady="1";
   box.classList.add("floatingManaged");

   const rect=box.getBoundingClientRect();
   box.style.position="fixed";
   box.style.left=`${Math.max(8,rect.left)}px`;
   box.style.top=`${Math.max(8,rect.top)}px`;
   box.style.transform="none";
   box.style.margin="0";

   const handle=(box.querySelector("header")||box.querySelector("p")) as HTMLElement|null;
   if(handle)handle.classList.add("floatingHandle");

   let minimize:HTMLButtonElement|null=null;
   if(box.classList.contains("utilityModal")&&handle&&!handle.querySelector("[data-floating-minimize]")){
    minimize=document.createElement("button");
    minimize.type="button";
    minimize.dataset.floatingMinimize="1";
    minimize.className="floatingMinimize";
    minimize.title="Minimizar / restaurar";
    minimize.setAttribute("aria-label","Minimizar / restaurar");
    minimize.textContent="−";
    const close=handle.querySelector("button");
    if(close)handle.insertBefore(minimize,close);else handle.appendChild(minimize);
    minimize.addEventListener("click",e=>{
     e.stopPropagation();
     box.classList.toggle("floatingMinimized");
     if(minimize)minimize.textContent=box.classList.contains("floatingMinimized")?"□":"−";
    });
   }

   let sx=0,sy=0,left=0,top=0;
   const onMove=(e:PointerEvent)=>{
    const maxX=Math.max(8,window.innerWidth-100),maxY=Math.max(8,window.innerHeight-48);
    box.style.left=`${Math.min(maxX,Math.max(8,left+e.clientX-sx))}px`;
    box.style.top=`${Math.min(maxY,Math.max(8,top+e.clientY-sy))}px`;
   };
   const onUp=()=>{
    window.removeEventListener("pointermove",onMove);
    window.removeEventListener("pointerup",onUp);
   };
   const onDown=(e:PointerEvent)=>{
    if(!handle||!handle.contains(e.target as Node))return;
    if((e.target as HTMLElement).closest("button,input,select,textarea,a"))return;
    const r=box.getBoundingClientRect();
    sx=e.clientX;sy=e.clientY;left=r.left;top=r.top;
    box.style.zIndex="90";
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    e.preventDefault();
   };
   handle?.addEventListener("pointerdown",onDown);
   cleanups.set(el,()=>{
    handle?.removeEventListener("pointerdown",onDown);
    window.removeEventListener("pointermove",onMove);
    window.removeEventListener("pointerup",onUp);
   });
  };

  const scan=()=>document.querySelectorAll(SELECTOR).forEach(prepare);
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();document.querySelectorAll(SELECTOR).forEach(el=>cleanups.get(el)?.())};
 },[]);
 return null;
}
