"use client";
import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
export default function InlineEditorRow({columns,label,children}:{columns:number;label:string;children:ReactNode}){const ref=useRef<HTMLDivElement>(null);useEffect(()=>{const node=ref.current;if(!node)return;node.scrollIntoView({block:'nearest'});(node.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])')||node).focus({preventScroll:true});},[]);return <tr><td colSpan={columns}><div ref={ref} tabIndex={-1} aria-label={label} className="panel">{children}</div></td></tr>;}
