"use client";

import {useEffect} from "react";

const replacements:[string,string][]=[
 ["Ã","Á"],["Ã‰","É"],["Ã","Í"],["Ã“","Ó"],["Ãš","Ú"],["Ã‘","Ñ"],["Ãœ","Ü"],
 ["Ã¡","á"],["Ã©","é"],["Ã­","í"],["Ã³","ó"],["Ãº","ú"],["Ã±","ñ"],["Ã¼","ü"],
 ["Ã","Á"],["Ã‰","É"],["Ã","Í"],["Ã“","Ó"],["Ãš","Ú"],["Ã‘","Ñ"],
 ["Â¿","¿"],["Â¡","¡"],["Â°","°"],["Âº","º"],["Âª","ª"],["Â·","·"],["Â "," "],
 ["â€“","–"],["â€”","—"],["â€œ","“"],["â€","”"],["â€˜","‘"],["â€™","’"],["â€¦","…"]
];

function repairText(value:string){
 let out=value;
 for(const [bad,good] of replacements)out=out.split(bad).join(good);
 return out.replace(/Â(?=[\s:;,.])/g,"");
}

export default function TextEncodingRepair(){
 useEffect(()=>{
  const repairNode=(node:Node)=>{
   if(node.nodeType===Node.TEXT_NODE){
    const before=node.nodeValue||"";
    if(/[ÃÂâ]/.test(before)){
     const after=repairText(before);
     if(after!==before)node.nodeValue=after;
    }
    return;
   }
   if(node.nodeType!==Node.ELEMENT_NODE)return;
   const el=node as HTMLElement;
   if(el.matches("script,style,textarea,input"))return;
   el.childNodes.forEach(repairNode);
  };
  repairNode(document.body);
  const observer=new MutationObserver(records=>records.forEach(r=>{
   if(r.type==="characterData")repairNode(r.target);
   r.addedNodes.forEach(repairNode);
  }));
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  return()=>observer.disconnect();
 },[]);
 return null;
}
