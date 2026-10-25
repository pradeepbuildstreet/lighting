import Link from 'next/link';
import type {AdminSection} from './AdminShell';
const sections=[['overview','/admin','Overview'],['catalogue','/admin/catalogue','Catalogue'],['taxonomy','/admin/reference-data','Reference Data'],['enquiries','/admin/enquiries','Enquiries'],['analytics','/admin/analytics','Wishlist analytics'],['homepage','/admin/homepage','Homepage collections'],['admins','/admin/users','Admin accounts']] as const;
export function ManagerTabs({active}:{active:AdminSection}){return <nav className="manager-tabs" aria-label="Admin sections">{sections.map(([key,href,label])=><Link key={key} href={href} prefetch={false} aria-current={active===key?'page':undefined}>{label}</Link>)}</nav>;}
