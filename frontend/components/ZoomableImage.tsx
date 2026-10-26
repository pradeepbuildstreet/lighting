"use client";
import {useEffect,useId,useRef,useState} from 'react';
import type {ImgHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import styles from './ZoomableImage.module.css';
type Zoom={url:string;left:number;top:number;size:number;x:number;y:number};
type Props=ImgHTMLAttributes<HTMLImageElement>&{alt:string};
export function ZoomableImage({alt,src,className,tabIndex,onMouseEnter,onMouseMove,onMouseLeave,onFocus,onBlur,onError,onLoad,onKeyDown,...rest}:Props){
 const ref=useRef<HTMLImageElement>(null),frame=useRef<number|null>(null),id=useId(),[zoom,setZoom]=useState<Zoom|null>(null),open=zoom!==null;
 function cancelFrame(){if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}}
 function hide(){cancelFrame();setZoom(null);}
 function show(el:HTMLImageElement,clientX?:number,clientY?:number){if(!el.complete||!el.naturalWidth||!el.isConnected)return;const r=el.getBoundingClientRect(),size=Math.max(96,Math.min(420,window.innerWidth-24,window.innerHeight-24)),right=r.right+12,left=right+size<=window.innerWidth-12?right:r.left-size-12>=12?r.left-size-12:Math.max(12,Math.min(r.left,window.innerWidth-size-12)),top=Math.max(12,Math.min(r.top,window.innerHeight-size-12)),clamp=(n:number)=>Math.max(0,Math.min(100,n));setZoom({url:el.currentSrc||String(src||''),left,top,size,x:clientX===undefined?50:clamp((clientX-r.left)/Math.max(1,r.width)*100),y:clientY===undefined?50:clamp((clientY-r.top)/Math.max(1,r.height)*100)});}
 useEffect(()=>{setZoom(null);cancelFrame();},[src]);
 useEffect(()=>()=>cancelFrame(),[]);
 useEffect(()=>{if(!open)return;const close=()=>{cancelFrame();setZoom(null);},key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key);};},[open]);
 const host=typeof document==='undefined'?null:ref.current?.closest('dialog')||document.body;
 return <><img {...rest} ref={ref} src={src} alt={alt} className={[className,styles.target].filter(Boolean).join(' ')} tabIndex={tabIndex??0} aria-describedby={[rest['aria-describedby'],zoom?id:undefined].filter(Boolean).join(' ')||undefined}
 onMouseEnter={e=>{onMouseEnter?.(e);if(!e.defaultPrevented&&window.matchMedia('(hover: hover) and (pointer: fine)').matches)show(e.currentTarget,e.clientX,e.clientY);}}
 onMouseMove={e=>{onMouseMove?.(e);if(!zoom||e.defaultPrevented)return;const el=e.currentTarget,x=e.clientX,y=e.clientY;cancelFrame();frame.current=requestAnimationFrame(()=>{frame.current=null;show(el,x,y);});}}
 onMouseLeave={e=>{onMouseLeave?.(e);if(document.activeElement!==e.currentTarget)hide();}}
 onFocus={e=>{onFocus?.(e);if(!e.defaultPrevented)show(e.currentTarget);}} onBlur={e=>{onBlur?.(e);hide();}}
 onError={e=>{hide();onError?.(e);}} onLoad={e=>{onLoad?.(e);if(document.activeElement===e.currentTarget)show(e.currentTarget);}}
 onKeyDown={e=>{onKeyDown?.(e);if(e.key==='Escape')hide();}}/>{zoom&&host&&createPortal(<aside id={id} role="tooltip" className={styles.preview} style={{left:zoom.left,top:zoom.top,width:zoom.size}}><div className={styles.window} style={{height:zoom.size-32}}><img src={zoom.url} alt="" aria-hidden="true" className={styles.zoomImage} style={{transformOrigin:zoom.x+'% '+zoom.y+'%',transform:'scale(2)'}} onError={hide}/></div><div className={styles.caption}>Magnified view: {alt}. Press Escape to close.</div></aside>,host)}</>;
}
