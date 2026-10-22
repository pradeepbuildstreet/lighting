import styles from './PublicationCompatibilityWarnings.module.css';
export function PublicationCompatibilityWarnings({warnings}:{warnings?:string[]}){
 const messages=Array.isArray(warnings)?warnings.filter((s):s is string=>typeof s==='string'&&s.trim().length>0):[];
 if(!messages.length)return null;
 return <section className={styles.warnings} aria-label="Publication warnings" role="status"><h4>Publication warnings</h4><ul>{messages.map((message,index)=><li key={message+'-'+index}>{message}</li>)}</ul><p>Warnings are advisory. Existing publication blockers are checked separately.</p></section>;
}
