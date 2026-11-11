import {AdminShell} from '@/components/AdminShell';
import {InteriorAdminManager} from '@/components/InteriorAdminManager';
import {InteriorProjectGroups} from '@/components/InteriorProjectGroups';
import {InteriorProjectCover} from '@/components/InteriorProjectCover';
import styles from './interiors.module.css';
export default function InteriorAdminPage(){return <AdminShell active="interiors"><div className={styles.workspace}><InteriorProjectGroups/><InteriorProjectCover/><InteriorAdminManager/></div></AdminShell>;}
