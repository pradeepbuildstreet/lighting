"use client";
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import styles from './StorefrontFrame.module.css';
export function StorefrontFrame({children}:{children:ReactNode}){
 const path=usePathname();
 const shopping=path==='/'||/^\/(products|categories|catalogue|item|product-collections|collections|brands|variants)(\/|$)/.test(path);
 return <main className={`site-main ${shopping?styles.shopping:''}`}>{children}</main>;
}
