import {groupedProductTags} from '@/lib/product-tag-table.mjs';
import type {ProductTagInput} from '@/lib/product-tag-table.mjs';
import styles from './ProductTagTable.module.css';
export function ProductTagTable({tags,filterAttribute,title}:{tags?:ProductTagInput[];filterAttribute:boolean;title:string}){
 const groups=groupedProductTags(tags,filterAttribute);
 if(!groups.length)return null;
 return <section className={styles.section}><h2 className="text-xl font-semibold mt-6">{title}</h2><div className={styles.wrap}><table className={styles.table}><caption className={styles.srOnly}>{title}</caption><thead><tr><th scope="col" className={styles.groupColumn}>Attribute</th><th scope="col">Values</th></tr></thead><tbody>{groups.map(group=><tr key={group.id}><th scope="row">{group.name}</th><td>{group.values.join(', ')}</td></tr>)}</tbody></table></div></section>;
}
