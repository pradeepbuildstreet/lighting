import type {ReactNode} from 'react';
import {ManagerTabs} from './ManagerTabs';
import {AdminSignOut} from './AdminSignOut';
import styles from './AdminShell.module.css';
export type AdminSection='overview'|'catalogue'|'taxonomy'|'enquiries'|'analytics'|'admins'|'homepage';
export function AdminShell({active,children}:{active:AdminSection;children:ReactNode}){return <section className={styles.shell} aria-label="Administration"><header className={styles.header}><div><p className={styles.eyebrow}>Luminoza / Administration</p><span>Store operations</span></div><AdminSignOut/></header><ManagerTabs active={active}/><div className={styles.content}>{children}</div></section>;}
