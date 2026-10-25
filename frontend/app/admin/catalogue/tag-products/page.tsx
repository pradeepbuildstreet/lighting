import {redirect} from 'next/navigation';
import {tagProductEntry} from '@/lib/admin-tag-product-entry.mjs';
export const dynamic='force-dynamic';
export default function TagProductsPage({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){const params=new URLSearchParams();for(const key of ['edit','new']){const value=searchParams[key];if(Array.isArray(value))for(const item of value)params.append(key,item);else if(value!==undefined)params.set(key,value);}const entry=tagProductEntry('?'+params.toString());if(entry?.mode==='edit')redirect('/admin/catalogue?product='+encodeURIComponent(entry.id)+'&mode=edit');redirect('/admin/catalogue');}
