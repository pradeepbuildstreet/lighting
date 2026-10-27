"use client";
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {usesStorefrontFrame} from '@/lib/storefront-frame.mjs';
import styles from './StorefrontFrame.module.css';
export function StorefrontFrame({children}:{children:ReactNode}){
 const path=usePathname();
 return <main className={`site-main ${usesStorefrontFrame(path)?styles.shopping:''}`}>{children}</main>;
}
