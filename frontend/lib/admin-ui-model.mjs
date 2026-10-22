import {itemIdentity,wishlistProductHref} from './catalogue-item-identity.js';
export function statusLabel(x){return {draft:'Draft',submitted:'Submitted',contacted:'Contacted',closed:'Closed',ready:'Ready to share',accepted:'Accepted',declined:'Declined',expired:'Expired'}[x]||String(x||'Unknown');}
export function identity(row){return 'catalogue:'+itemIdentity(row);}
export function productLink(row){return wishlistProductHref(row);}
export function filterEnquiries(rows,query='',status='all'){const q=query.trim().toLocaleLowerCase();return rows.filter(r=>(status==='all'||r.status===status)&&(!q||[r.customer_name,r.mobile_number,r.email,r.pin_code].some(x=>String(x||'').toLocaleLowerCase().includes(q)))).slice().sort((a,b)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime());}
export function pageRows(rows,page=1,size=25){const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(Math.max(1,page),pages);return {rows:rows.slice((current-1)*size,current*size),page:current,pages,total:rows.length};}
export function effectiveOfferStatus(status,expiresAt,now=Date.now()){return status==='ready'&&expiresAt&&new Date(expiresAt).getTime()<now?'expired':status;}
export function money(value,currency='INR'){if(value===null||value===undefined||String(value).trim()==='')return 'Not available';const n=Number(value);if(!Number.isFinite(n))return 'Not available';try{return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(n);}catch(_){return n.toFixed(2)+' '+currency;}}
