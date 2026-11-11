import {AdminShell} from '@/components/AdminShell';
import {InteriorAdminManager} from '@/components/InteriorAdminManager';
import {InteriorProjectGroups} from '@/components/InteriorProjectGroups';
import styles from './interiors.module.css';
export default function InteriorAdminPage(){return <AdminShell active="interiors"><div className={styles.workspace}><InteriorProjectGroups/><InteriorAdminManager/></div></AdminShell>;}
