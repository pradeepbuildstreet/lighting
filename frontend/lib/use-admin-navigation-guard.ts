"use client";
import {useEffect} from 'react';
export function useAdminNavigationGuard(dirty:boolean,busy:boolean,label:string){useEffect(()=>{
 const allowed=()=>!busy&&(!dirty||window.confirm('Discard unsaved '+label+' edits and leave?'));
 const click=(e:MouseEvent)=>{const el=e.target instanceof Element?e.target:null;if(!el)return;const signOut=el.closest('button.admin-signout'),anchor=el.closest('a');if(!signOut&&!anchor)return;if(anchor&&(anchor.target==='_blank'||anchor.hasAttribute('download')||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||anchor.href===window.location.href))return;if(!allowed()){e.preventDefault();e.stopImmediatePropagation();}};
 const unload=(e:BeforeUnloadEvent)=>{if(dirty||busy){e.preventDefault();e.returnValue='';}};
 const traverse=(e:Event)=>{if((e as Event&{navigationType?:string}).navigationType==='traverse'&&e.cancelable&&!allowed())e.preventDefault();};
 const nav=(window as Window&{navigation?:EventTarget}).navigation;nav?.addEventListener('navigate',traverse);document.addEventListener('click',click,true);window.addEventListener('beforeunload',unload);
 return()=>{nav?.removeEventListener('navigate',traverse);document.removeEventListener('click',click,true);window.removeEventListener('beforeunload',unload);};
 },[dirty,busy,label]);}
