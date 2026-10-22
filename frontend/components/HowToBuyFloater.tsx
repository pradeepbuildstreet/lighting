"use client";
import Link from 'next/link';
import {useEffect,useId,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import styles from './HowToBuyFloater.module.css';
export function HowToBuyFloater(){
 const pathname=usePathname(),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),titleId=useId();
 const [open,setOpen]=useState(false);
 useEffect(()=>{setOpen(false);const el=dialog.current;if(el?.open)el.close();return()=>{if(el?.open)el.close();};},[pathname]);
 if(!pathname||pathname==='/admin'||pathname.startsWith('/admin/'))return null;
 function close(){dialog.current?.close();}
 return <><button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{if(dialog.current&&!dialog.current.open){dialog.current.showModal();setOpen(true);}}}>How to buy?</button>
 <dialog ref={dialog} className={styles.modal} aria-labelledby={titleId} onClose={()=>{setOpen(false);trigger.current?.focus();}}>
 <div className={styles.body}><header className={styles.heading}><h2 id={titleId}>How to buy from Luminoza</h2><button type="button" className={styles.close} onClick={close} aria-label="Close buying guide" autoFocus>Close</button></header>
 <p>We help you select lighting and prepare a personalised offer. There is no website checkout.</p>
 <ol className={styles.steps}><li><strong>Browse products.</strong> Explore the catalogue and curated collections.</li><li><strong>Build your wishlist.</strong> Use the heart button to shortlist products.</li><li><strong>Submit an enquiry.</strong> Review quantities and share your contact details and requirements.</li><li><strong>Receive a personalised offer.</strong> We discuss your selection and share pricing and terms.</li><li><strong>Confirm with Luminoza.</strong> Finalise the offer and coordinate payment and delivery directly with us.</li></ol>
 <nav className={styles.links} aria-label="Buying guide actions"><Link href="/products" onClick={close}>Browse products</Link><Link href="/wishlist" onClick={close}>View wishlist</Link></nav></div></dialog></>;
}
