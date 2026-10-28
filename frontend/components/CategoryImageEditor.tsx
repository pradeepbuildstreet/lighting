"use client";
import {useEffect,useRef,useState} from 'react';
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
type ImageInfo={revision:string;content_type:string;bytes:number};
const root='/api/admin/catalogue/taxonomy/category-images/';
async function request(path:string,init:RequestInit={}){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);
 try{const response=await fetch(path,{...init,credentials:'same-origin',cache:'no-store',signal:c.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'Image request failed');if(data.image!==null&&(!data.image||typeof data.image.revision!=='string'||!/^[0-9a-f-]{36}$/i.test(data.image.revision)))throw new Error('Invalid image response; reload saved state.');return data.image as ImageInfo|null;}finally{clearTimeout(timer);}
}
export function CategoryImageEditor({categoryId,name,busy:parentBusy,onBusyChange}:{categoryId:string;name:string;busy:boolean;onBusyChange:(value:boolean)=>void}){
 const [image,setImage]=useState<ImageInfo|null>(null),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[blocked,setBlocked]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const input=useRef<HTMLInputElement>(null),lock=useRef(false);
 useAdminNavigationGuard(!!file,busy,'category image');
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{let live=true;setReady(false);setError('');setImage(null);setFile(null);setBlocked(false);setBusy(true);void request(root+categoryId).then(value=>{if(live){setImage(value);setReady(true);}}).catch(e=>{if(live)setError((e as Error).message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[categoryId]);
 async function reload(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setReady(false);try{setImage(await request(root+categoryId));setFile(null);if(input.current)input.current.value='';setReady(true);setBlocked(false);setNotice('Saved image reloaded.');}catch(e){setError((e as Error).message);}finally{setBusy(false);lock.current=false;}}
 async function save(remove=false){if(lock.current||parentBusy||!ready||blocked||(!remove&&!file))return;if(remove&&!window.confirm('Remove the image for '+name+'? The homepage will use the placeholder.'))return;lock.current=true;setBusy(true);setError('');setNotice('');try{
  let init:RequestInit;
  if(remove)init={method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:image?.revision||'none'})};
  else{const body=new FormData();body.append('expected_revision',image?.revision||'none');body.append('image',file!);init={method:'PUT',body};}
  setImage(await request(root+categoryId,init));setFile(null);if(input.current)input.current.value='';setNotice(remove?'Category image removed. Placeholder restored.':'Category image saved.');
 }catch(e){setError((e as Error).message+' Reload saved image before retrying.');setBlocked(true);}finally{setBusy(false);lock.current=false;}}
 const disabled=parentBusy||busy||!ready||blocked,src=preview||(image?root+categoryId+'/content/'+image.revision:'/images/category-placeholder.svg');
 return <section aria-label="Category image"><h3>Category image</h3><p>This image represents {name||'this category'} on the homepage. Upload JPEG or PNG, maximum 5 MB. Images are saved separately from category details.</p><img src={src} alt={preview?'Selected category image preview':name+' category image'} width={180} height={180} style={{objectFit:'contain',background:'#f4f4f4'}}/>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Working on category image…</p>}<label className="field">Choose category image<input ref={input} type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={e=>{setError('');setNotice('');const next=e.target.files?.[0]||null;if(next&&(next.size>5242880||!['image/jpeg','image/png'].includes(next.type))){setFile(null);e.target.value='';setError('Choose JPEG or PNG, maximum 5 MB.');return;}setFile(next);}}/></label><button type="button" disabled={disabled||!file} onClick={()=>void save()}>{image?'Replace image':'Upload image'}</button><button type="button" disabled={disabled||!image} onClick={()=>void save(true)}>Remove image</button><button type="button" disabled={parentBusy||busy} onClick={()=>void reload()}>Reload saved image / discard selection</button></section>;
}
