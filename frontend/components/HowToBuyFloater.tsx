"use client";
import Link from 'next/link';
import {useEffect,useId,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import styles from './HowToBuyFloater.module.css';
export function HowToBuyFloater({request=0,triggerClassName,onClosed}:{request?:number;triggerClassName?:string;onClosed?:()=>void}){
 const pathname=usePathname(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),titleId=useId();
 const [open,setOpen]=useState(false),allowed=!!pathname&&pathname!=='/admin'&&!pathname.startsWith('/admin/');
 function show(){if(allowed&&dialog.current&&!dialog.current.open){dialog.current.showModal();setOpen(true);}}
 useEffect(()=>{setOpen(false);const el=dialog.current;if(el?.open)el.close();return()=>{if(el?.open)el.close();};},[pathname]);
 useEffect(()=>{if(request>0)show();},[request]);
 useEffect(()=>{if(!open)return;const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[open]);
 if(!allowed)return null;
 function close(){dialog.current?.close();}
 return <><button ref={trigger} type="button" className={triggerClassName||styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={show}>How to buy?</button>
 <dialog ref={dialog} className={styles.modal} aria-labelledby={titleId} onClose={()=>{setOpen(false);if(trigger.current?.getClientRects().length)trigger.current.focus();else onClosed?.();}}>
 <div className={styles.body}><header className={styles.heading}><h2 id={titleId}>How to buy from Luminoza</h2><button type="button" className={styles.close} onClick={close} aria-label="Close buying guide" autoFocus>Close</button></header>
 <p>We help you select lighting and prepare a personalised offer. There is no website checkout.</p>
 <ol className={styles.steps}><li><strong>Browse products.</strong> Explore the catalogue and curated collections.</li><li><strong>Build your wishlist.</strong> Use the heart button to shortlist products.</li><li><strong>Submit an enquiry.</strong> Review quantities and share your contact details and requirements.</li><li><strong>Receive a personalised offer.</strong> We discuss your selection and share pricing and terms.</li><li><strong>Confirm with Luminoza.</strong> Finalise the offer and coordinate payment and delivery directly with us.</li></ol>
 <nav className={styles.links} aria-label="Buying guide actions"><Link href="/products" onClick={close}>Browse products</Link><Link href="/wishlist" onClick={close}>View wishlist</Link></nav></div></dialog></>;
}
