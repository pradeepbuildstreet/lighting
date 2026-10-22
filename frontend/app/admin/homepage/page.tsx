import {AdminShell} from '@/components/AdminShell';
import {HomepageCollectionManager} from '@/components/HomepageCollectionManager';
export const metadata={title:'Homepage collections | Luminoza Admin',robots:{index:false,follow:false}};
export default function HomepageAdminPage(){return <AdminShell active="homepage"><HomepageCollectionManager/></AdminShell>;}
