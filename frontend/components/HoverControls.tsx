"use client";
import {useEffect,useId,useRef,useState,type ReactNode,type KeyboardEvent} from 'react';
import {TouchDialog} from './TouchDialog';
import {useTouchDialogs} from './useTouchDialogs';
import styles from './ShoppingInteractions.module.css';
export function HoverPopover({label,children,align='start',kind='menu'}:{label:string;children:ReactNode|((close:()=>void)=>ReactNode);align?:'start'|'end';kind?:'menu'|'dialog'}){
 const id=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),touch=useTouchDialogs();
 const [open,setOpen]=useState(false),[pinned,setPinned]=useState(false);
 function cancel(){if(timer.current)clearTimeout(timer.current);}
 function close(){cancel();setOpen(false);setPinned(false);}
 function show(){cancel();window.dispatchEvent(new CustomEvent('shop-popover-open',{detail:id}));setOpen(true);}
 useEffect(()=>{close();},[touch]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(!touch&&e.target instanceof Node&&!root.current?.contains(e.target))close();};const other=(e:Event)=>{if((e as CustomEvent).detail!==id)close();};document.addEventListener('pointerdown',outside);window.addEventListener('shop-popover-open',other);return()=>{cancel();document.removeEventListener('pointerdown',outside);window.removeEventListener('shop-popover-open',other);};},[id,touch]);
 function focusItem(last=false){requestAnimationFrame(()=>{const items=root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)');if(items?.length)items[last?items.length-1:0].focus();});}
 function keys(e:KeyboardEvent<HTMLDivElement>){
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();if(!touch)trigger.current?.focus();return;}
  if(kind!=='menu'||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();show();setPinned(true);const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)')||[]),index=items.findIndex(item=>item===document.activeElement);
  if(index<0){focusItem(e.key==='ArrowUp'||e.key==='End');return;}
  const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();
 }
 const content=()=>typeof children==='function'?children(()=>{close();if(!touch)trigger.current?.focus();}):children;
 return <div ref={root} className={styles.popover} onKeyDown={keys} onPointerEnter={e=>{if(!touch&&e.pointerType==='mouse'&&window.matchMedia('(hover:hover)').matches)show();}} onPointerLeave={()=>{if(touch)return;cancel();timer.current=setTimeout(()=>{if(!pinned&&!root.current?.contains(document.activeElement))close();},180);}} onBlur={e=>{if(!touch&&(!(e.relatedTarget instanceof Node)||!e.currentTarget.contains(e.relatedTarget)))close();}}>
  <button ref={trigger} className={styles.popoverTrigger} type="button" aria-haspopup={touch?'dialog':kind} aria-expanded={open} aria-controls={!touch&&open?id:undefined} onClick={()=>{if(open&&pinned)close();else{show();setPinned(true);}}}>{label}<span aria-hidden="true">▾</span></button>
  {touch?<TouchDialog open={open} title={label} onClose={close} closeOnSubmit returnFocus={()=>trigger.current}><div role={kind==='menu'?'menu':undefined} aria-label={kind==='menu'?label:undefined}>{open?content():null}</div></TouchDialog>:open&&<div id={id} className={`${styles.popoverPanel} ${align==='end'?styles.alignEnd:''}`} role={kind} aria-label={label}>{content()}</div>}
 </div>;
}
export type HoverChoiceOption={value:string;label:string;disabled?:boolean};
export function HoverChoice({label,value,options,onChange,mobile=false,align='start'}:{label:string;value:string;options:HoverChoiceOption[];onChange:(value:string)=>void;mobile?:boolean;align?:'start'|'end'}){
 const selected=options.find(option=>option.value===value);
 if(mobile)return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select></label>;
 const caption=selected&&value?`${label}: ${selected.label}`:label;
 return <HoverPopover label={caption} align={align}>{close=>options.map(option=><button key={option.value} type="button" role="menuitemradio" aria-checked={value===option.value} disabled={option.disabled} className={styles.option} onClick={()=>{onChange(option.value);close();}}><span aria-hidden="true">{value===option.value?'●':'○'}</span>{option.label}</button>)}</HoverPopover>;
}
