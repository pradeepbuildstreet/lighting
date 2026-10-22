"use client";
import {useAdminNavigationGuard} from '@/lib/use-admin-navigation-guard';
import uiStyles from './CatalogueUI.module.css';
import ProductPreview from './ProductPreview';
import {useEffect,useRef,useState} from 'react';
import ProductConfigurationPanel from './ProductConfigurationPanel';
import ProductReviewPanel from './ProductReviewPanel';
import CatalogueImportPanel from './CatalogueImportPanel';
import ProductAdminView from './ProductAdminView';
import ProductVisibility from './ProductVisibility';
import {formSnapshot,referenceSnapshot,isDirty,navigationBlocked} from './ui-flow.mjs';

type Row = Record<string, any>;
type Tab = 'categories'|'fixture-types'|'light-types'|'dealers';
type Workspace='products'|'import'|'review'|'reference';
type ProductMode='list'|'view'|'edit';
type ProductPanel='overview'|'configuration'|'dealers'|'review';
const tabs:Tab[]=['categories','fixture-types','light-types','dealers'];
const label=(s:string)=>s.replace(/[_-]/g,' ');
const emptyProduct=():Row=>({sku:'',name:'',product_kind:'fixture',brand:'',model_number:'',description:'',selling_price:'',currency:'INR',is_active:true,category_ids:[],primary_category_id:'',specs:{fixture_type_id:'',light_source_mode:'replaceable',other_specs:{},inbuilt_specs:{}}});
const emptyMaster=():Row=>({name:'',code:'',dealer_code:'',slug:'',parent_id:'',description:'',sort_order:0,is_active:true,base_type:'',technology:'',contact_person:'',phone:'',email:'',gstin:'',address:{}});
async function api(path:string,method='GET',body?:unknown){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 try{const res=await fetch('/api/admin/catalogue'+path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 const data=await res.json();if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);return data;
 }catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error(method==='GET'?'Request timed out; retry loading.':'Request timed out; reload saved data before repeating the write.');throw e;}finally{clearTimeout(timeout);}
}
function categoryPath(id:string,rows:Row[]):string{
 const parts:string[]=[];const seen=new Set<string>();let next=id;
 while(next&&!seen.has(next)){seen.add(next);const row=rows.find(x=>x.id===next);if(!row)break;parts.unshift(row.name);next=row.parent_id;}
 return parts.join(' → ');
}
export default function CatalogueManager(){
 const [previewOpen,setPreviewOpen]=useState(false);
 const [workspace,setWorkspace]=useState<Workspace>('products');
 const [productMode,setProductMode]=useState<ProductMode>('list');const [productPanel,setProductPanel]=useState<ProductPanel>('overview');
 const navigationEpoch=useRef(0);const productBaseline=useRef('');const masterBaseline=useRef('');
 const [readBusy,setReadBusy]=useState(false);const [importBusy,setImportBusy]=useState(false);const [reviewBusy,setReviewBusy]=useState(false);
 const [tab,setTab]=useState<Tab>('categories');const [masters,setMasters]=useState<Record<string,Row[]>>({});
 const [products,setProducts]=useState<Row[]>([]);const [product,setProduct]=useState<Row>(emptyProduct());const [master,setMaster]=useState<Row>(emptyMaster());
 const [addressText,setAddressText]=useState('{}');const [otherSpecText,setOtherSpecText]=useState('{}');const [inbuiltText,setInbuiltText]=useState('{}');
 const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [listings,setListings]=useState<Row[]>([]);const [history,setHistory]=useState<Row[]>([]);
 const [attach,setAttach]=useState<Row>({dealer_id:'',dealer_sku:'',minimum_order_qty:1,lead_time_days:''});
 const [quote,setQuote]=useState<Row>({listing_id:'',currency:'INR',list_price:'',discount_percent:0,price_basis:'tax_exclusive',tax_percent:''});
 const categories=masters.categories||[];
 async function refresh(query=search){
  await api('/state');const [m,p]=await Promise.all([api('/bootstrap'),api('/products?q='+encodeURIComponent(query))]);setMasters(m);setProducts(p.products);setReady(true);
 }
 async function perform(fn:()=>Promise<void>,write=false){
  const epoch=navigationEpoch.current;(write?setBusy:setReadBusy)(true);setError('');setNotice('');
  try{await fn();}catch(e){if(epoch===navigationEpoch.current||write)setError(e instanceof Error?e.message:'Operation failed');}finally{(write?setBusy:setReadBusy)(false);}
 }
 const performWrite=(fn:()=>Promise<void>)=>perform(fn,true);
 useEffect(()=>{
  masterBaseline.current=JSON.stringify([emptyMaster(),'{}']);const params=new URLSearchParams(window.location.search);
  let saved:{workspace?:string;reference?:string;search?:string}={};try{saved=JSON.parse(sessionStorage.getItem('luminoza-catalogue-ui')||'{}');}catch(_){}
  const requested=params.get('workspace')||saved.workspace;if(['products','import','review','reference'].includes(requested||''))setWorkspace(requested as Workspace);
  const ref=params.get('reference')||saved.reference;if(tabs.includes(ref as Tab)){if(params.get('reference'))setWorkspace('reference');setTab(ref as Tab);}
  if(typeof saved.search==='string')setSearch(saved.search);void perform(()=>refresh(saved.search||''));
 },[]);
 useEffect(()=>{if(ready){try{sessionStorage.setItem('luminoza-catalogue-ui',JSON.stringify({workspace,reference:tab,search}));}catch(_){}}},[ready,workspace,tab,search]);
 const draftDirty=workspace==='products'&&productMode==='edit'&&isDirty(signature(product,otherSpecText,inbuiltText),productBaseline.current)||workspace==='reference'&&isDirty(referenceSnapshot(master,addressText),masterBaseline.current);
 useAdminNavigationGuard(draftDirty,busy||importBusy||reviewBusy,'catalogue');

 function field(obj:Row,set:(v:Row)=>void,key:string,type='text',disabled=false){return <label className="field" key={key}>{label(key)}<input type={type} step={type==='number'?'any':undefined} value={obj[key]??''} disabled={disabled||busy} onChange={e=>set({...obj,[key]:e.target.value})} /></label>;}
 function changeSpec(key:string,value:unknown){setProduct({...product,specs:{...product.specs,[key]:value}});}
 function signature(p:Row,other:string,integrated:string){return formSnapshot(p,other,integrated);}
 function canLeave(){
  if(navigationBlocked(busy)||importBusy||reviewBusy)return false;
  if(workspace==='products'&&productMode==='edit'&&isDirty(signature(product,otherSpecText,inbuiltText),productBaseline.current)&&!window.confirm('Discard unsaved product edits?'))return false;
  if(workspace==='reference'&&isDirty(referenceSnapshot(master,addressText),masterBaseline.current)&&!window.confirm('Discard unsaved reference-data edits?'))return false;
  return true;
 }
 function selectWorkspace(next:Workspace){if(next===workspace||!canLeave())return;navigationEpoch.current++;if(workspace==='products'&&productMode==='edit')setProductMode('list');if(workspace==='reference'){const m=emptyMaster();setMaster(m);setAddressText('{}');masterBaseline.current=JSON.stringify([m,'{}']);}setWorkspace(next);setPreviewOpen(false);setError('');setNotice('');}
 async function editProduct(id:string){
  const epoch=navigationEpoch.current;
  const [d,listingData]=await Promise.all([api('/products/'+id),api('/products/'+id+'/dealers')]);
  if(epoch!==navigationEpoch.current)return false;
  const other=JSON.stringify(d.product.specs.other_specs||{},null,2),integrated=JSON.stringify(d.product.specs.inbuilt_specs||{},null,2);
  setProduct(d.product);setOtherSpecText(other);setInbuiltText(integrated);productBaseline.current=signature(d.product,other,integrated);
  setHistory([]);setListings(listingData.listings);setAttach({dealer_id:'',dealer_sku:'',minimum_order_qty:1,lead_time_days:''});setQuote({listing_id:'',currency:'INR',list_price:'',discount_percent:0,price_basis:'tax_exclusive',tax_percent:''});return true;
 }
 async function openProduct(id:string,mode:ProductMode='view',panel:ProductPanel='overview'){
  if(!canLeave())return;navigationEpoch.current++;setWorkspace('products');setPreviewOpen(false);setProductMode('list');
  await perform(async()=>{if(await editProduct(id)){setProductMode(mode);setProductPanel(panel);}});
 }
 function newProduct(){if(!canLeave())return;navigationEpoch.current++;const p=emptyProduct();setProduct(p);setOtherSpecText('{}');setInbuiltText('{}');productBaseline.current=signature(p,'{}','{}');setListings([]);setHistory([]);setProductMode('edit');setProductPanel('overview');setPreviewOpen(false);}
 function beginEdit(){if(reviewBusy){setError('Wait for this product’s review operation to finish.');return;}productBaseline.current=signature(product,otherSpecText,inbuiltText);setProductMode('edit');setPreviewOpen(false);}
 async function cancelEdit(){if(!canLeave())return;if(product.id){await perform(async()=>{if(await editProduct(product.id))setProductMode('view');});}else setProductMode('list');}
 async function changedSelected(){await refresh();if(product.id)await editProduct(product.id);}
 async function saveProduct(){
  const payload={...product,specs:{...product.specs,other_specs:JSON.parse(otherSpecText),...(product.product_kind==='fixture'?{inbuilt_specs:JSON.parse(inbuiltText)}:{})}};
  const d=await api('/products'+(product.id?'/'+product.id:''),product.id?'PUT':'POST',payload);setProduct(d.product);const other=JSON.stringify(d.product.specs.other_specs||{},null,2),integrated=JSON.stringify(d.product.specs.inbuilt_specs||{},null,2);setOtherSpecText(other);setInbuiltText(integrated);productBaseline.current=signature(d.product,other,integrated);setProductMode('view');setProductPanel('overview');await refresh();await editProduct(d.product.id);setNotice('Product saved as an unpublished draft. Check customer visibility and complete review before publishing.');
 }
 function switchTab(t:Tab){if(!canLeave())return;navigationEpoch.current++;setAddressText('{}');setTab(t);const m=emptyMaster();setMaster(m);masterBaseline.current=JSON.stringify([m,'{}']);setError('');setNotice('');}
 async function saveMaster(){
  const payload={...master,parent_id:master.parent_id||null,...(tab==='dealers'?{address:JSON.parse(addressText)}:{})};
  await api('/'+tab+(master.id?'/'+master.id:''),master.id?'PUT':'POST',payload);const m=emptyMaster();setMaster(m);setAddressText('{}');masterBaseline.current=JSON.stringify([m,'{}']);await refresh();setNotice('Master record saved.');
 }
 return <main className={`catalogue ${uiStyles.root}`}>
 <h1>Catalogue administration</h1>
 <p><a href="/admin">Admin overview</a> · View is read-only; Edit changes a draft; Preview shows customer presentation.</p>
 <nav aria-label="Catalogue workspaces">{([['products','Products'],['import','Bulk import'],['review','Review queue'],['reference','Reference data']] as [Workspace,string][]).map(([key,name])=><button type="button" key={key} disabled={busy||importBusy||reviewBusy} aria-pressed={workspace===key} onClick={()=>selectWorkspace(key)}>{name}</button>)}</nav>
 {busy&&<p role="status">Saving… please wait before leaving this workspace.</p>}
 {error&&<div role="alert" className="error">{error}<button type="button" disabled={busy||readBusy} onClick={()=>void perform(refresh)}>Retry loading</button></div>}
 {notice&&<p role="status" className="notice">{notice}</p>}
 {!ready?<p>Loading catalogue configuration. If loading fails, use Retry loading above.</p>:<>
 <div hidden={workspace!=='import'}><CatalogueImportPanel parentBusy={false} onBusyChange={setImportBusy} onCommitted={refresh} onViewProduct={id=>openProduct(id,'view')}/>{importBusy&&<p role="status">Import operation in progress. You can use Reference data without losing this preview.</p>}<div className="actions"><button type="button" onClick={()=>selectWorkspace('products')}>View products</button><button type="button" onClick={()=>selectWorkspace('review')}>Open review queue</button></div></div>
 <div hidden={workspace!=='review'}><ProductReviewPanel mode="queue" parentBusy={false} onBusyChange={setReviewBusy} onChanged={refresh} onOpenProduct={(id,view)=>openProduct(id,view?'view':'edit')} onReviewProduct={id=>openProduct(id,'view','review')}/></div>
 {workspace==='reference'&&<><nav aria-label="Reference data">{tabs.map(key=><button type="button" key={key} disabled={busy} aria-pressed={tab===key} onClick={()=>switchTab(key)}>{label(key)}</button>)}</nav><><section className="panel"><h2>{label(tab)}</h2><button disabled={busy} onClick={()=>{if(!canLeave())return;const m=emptyMaster();setMaster(m);setAddressText('{}');masterBaseline.current=JSON.stringify([m,'{}']);}}>New record</button><div className="scroll"><table><thead><tr><th>Code / slug</th><th>Name</th><th>Active</th><th/></tr></thead><tbody>{(masters[tab]||[]).map(m=><tr key={m.id}><td>{m.slug||m.dealer_code||m.code}</td><td>{m.name}</td><td>{m.is_active?'Yes':'No'}</td><td><button disabled={busy} onClick={()=>{if(!canLeave())return;const next={...emptyMaster(),...m},text=JSON.stringify(m.address||{},null,2);setMaster(next);setAddressText(text);masterBaseline.current=JSON.stringify([next,text]);}}>Edit</button></td></tr>)}</tbody></table></div></section>
 <form className="panel" onSubmit={e=>{e.preventDefault();void performWrite(saveMaster);}}><h2>{master.id?'Edit':'New'} {label(tab)}</h2><div className="grid">{field(master,setMaster,tab==='categories'?'slug':tab==='dealers'?'dealer_code':'code','text',!!master.id&&tab!=='categories')}{field(master,setMaster,'name')}
 {tab==='categories'?<><label className="field">Parent category<select value={master.parent_id||''} onChange={e=>setMaster({...master,parent_id:e.target.value})}><option value="">Root</option>{categories.filter(c=>c.id!==master.id).map(c=><option key={c.id} value={c.id}>{categoryPath(c.id,categories)}</option>)}</select></label>{field(master,setMaster,'sort_order','number')}{field(master,setMaster,'description')}</>:null}
 {tab==='light-types'?<>{field(master,setMaster,'base_type')}{field(master,setMaster,'technology')}</>:null}
 {tab==='dealers'?<>{['contact_person','phone','email','gstin'].map(f=>field(master,setMaster,f))}<label className="field">Address (JSON object)<textarea value={addressText} onChange={e=>setAddressText(e.target.value)}/></label></>:null}
 <label className="field">Active<input type="checkbox" checked={!!master.is_active} onChange={e=>setMaster({...master,is_active:e.target.checked})}/></label></div><button disabled={busy}>Save record</button><p>Disable records rather than deleting referenced catalogue data.</p></form></></>}
 {workspace==='products'&&<>
 {productMode==='list'?<section className="panel"><h2>Products</h2><div className="actions"><input aria-label="SKU or name search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU or name"/><button type="button" disabled={busy||readBusy} onClick={()=>void perform(refresh)}>Search</button><button type="button" disabled={busy||readBusy} onClick={newProduct}>New product</button></div>
 {readBusy&&<p role="status">Loading product…</p>}<p>Up to 200 products. Use search to narrow the list. View is read-only; Edit opens the form.</p>
 <div className="scroll"><table><thead><tr><th>SKU</th><th>Name</th><th>Kind</th><th>Review status</th><th>Publication / customer visibility</th><th>Actions</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.sku}</td><td>{p.name}</td><td>{p.product_kind}</td><td><span className="enquiry-status">{p.review_status||'draft'}</span></td><td><ProductVisibility compact visibility={p.visibility} disabled={readBusy||busy} onReview={()=>void openProduct(p.id,'view','review')}/></td><td><button type="button" disabled={readBusy||busy} className="catalogue-secondary" onClick={()=>void openProduct(p.id,'view')}>View</button><button type="button" disabled={readBusy||busy} className="catalogue-secondary" onClick={()=>void openProduct(p.id,'edit')}>Edit</button></td></tr>)}</tbody></table></div>
 </section>:<>
 <section className="panel"><div className="actions"><button type="button" disabled={busy} onClick={()=>{if(!canLeave())return;navigationEpoch.current++;setProductMode('list');setPreviewOpen(false);}}>Back to Products</button></div><h2>{product.sku||'New product'} — {product.name||'Draft'}</h2><p>{productMode==='edit'?'Editing':'Saved product'} · Revision {product.revision??'Not saved'} · {product.review_status||'draft'}</p>
 {product.id&&<ProductVisibility visibility={product.visibility} disabled={busy||readBusy||reviewBusy} onReview={()=>void openProduct(product.id,'view','review')}/>}
 {productMode==='view'&&<nav aria-label="Selected product sections">{([['overview','Admin view'],['configuration','Manage media / light configuration'],['dealers','Manage dealer listings'],['review','Review & publication']] as [ProductPanel,string][]).map(([key,name])=><button type="button" key={key} disabled={busy||reviewBusy} aria-pressed={productPanel===key} onClick={()=>{setProductPanel(key);setPreviewOpen(false);}}>{name}</button>)}</nav>}
 </section>
 {productMode==='edit'? <form id="catalogue-product-editor" tabIndex={-1} className="panel" onSubmit={e=>{e.preventDefault();void performWrite(saveProduct);}}><fieldset disabled={busy}><h2>{product.id?'Edit':'New'} product</h2>
 <div className="grid">{field(product,setProduct,'sku')}{field(product,setProduct,'name')}
 <label className="field">Product kind<select disabled={busy||!!product.id} value={product.product_kind} onChange={e=>setProduct({...emptyProduct(),...product,product_kind:e.target.value,specs:e.target.value==='fixture'?{fixture_type_id:'',light_source_mode:'replaceable',other_specs:{},inbuilt_specs:{}}:{light_type_id:'',dimmable:null,other_specs:{}}})}><option value="fixture">Fixture</option><option value="light">Light</option></select></label>
 {field(product,setProduct,'brand')}{field(product,setProduct,'model_number')}{field(product,setProduct,'selling_price','number')}{field(product,setProduct,'currency')}
 <label className="field">Active<input type="checkbox" checked={!!product.is_active} onChange={e=>setProduct({...product,is_active:e.target.checked})}/></label>
 </div><label className="field">Description<textarea value={product.description||''} onChange={e=>setProduct({...product,description:e.target.value})}/></label>
 <h3>Categories</h3><div className="grid">{categories.map(c=><label key={c.id}><input type="checkbox" disabled={!c.is_active||busy} checked={product.category_ids.includes(c.id)} onChange={e=>{const ids=e.target.checked?[...product.category_ids,c.id]:product.category_ids.filter((id:string)=>id!==c.id);setProduct({...product,category_ids:ids,primary_category_id:ids.includes(product.primary_category_id)?product.primary_category_id:''});}}/> {categoryPath(c.id,categories)}{!c.is_active?' (inactive)':''}</label>)}</div>
 <label className="field">Primary category<select value={product.primary_category_id||''} onChange={e=>setProduct({...product,primary_category_id:e.target.value})}><option value="">Not selected (draft only)</option>{categories.filter(c=>product.category_ids.includes(c.id)).map(c=><option key={c.id} value={c.id}>{categoryPath(c.id,categories)}</option>)}</select></label>
 <p>Breadcrumb preview: Home → {product.primary_category_id?categoryPath(product.primary_category_id,categories):'[primary category required]'} → {product.name||'[product name]'}</p>
 <h3>{product.product_kind==='fixture'?'Fixture':'Light'} specifications</h3><div className="grid">
 <label className="field">{product.product_kind==='fixture'?'Fixture':'Light'} type *<select required value={product.specs[product.product_kind==='fixture'?'fixture_type_id':'light_type_id']||''} onChange={e=>changeSpec(product.product_kind==='fixture'?'fixture_type_id':'light_type_id',e.target.value)}><option value="">Select</option>{(masters[product.product_kind==='fixture'?'fixture-types':'light-types']||[]).map(t=><option disabled={!t.is_active} key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
 {product.product_kind==='fixture'?<label className="field">Light source mode<select value={product.specs.light_source_mode} onChange={e=>{const next=e.target.value;if(!window.confirm('Change light-source mode? Integrated specifications are cleared when switching to Replaceable. Remove socket groups explicitly before switching to Integrated.'))return;setProduct({...product,mode_change_confirmed:true,specs:{...product.specs,light_source_mode:next,...(next==='replaceable'?{inbuilt_specs:{}}:{})}});if(next==='replaceable')setInbuiltText('{}');}}>{['replaceable','integrated','hybrid'].map(x=><option key={x} value={x}>{x.charAt(0).toUpperCase()+x.slice(1)}</option>)}</select></label>:null}
 {(product.product_kind==='fixture'?['material','style','mounting_type','width_mm','depth_mm','height_mm']:['wattage','lumens','color_temperature_k','voltage_min','voltage_max','diameter_mm','length_mm']).map(f=><label key={f} className="field">{label(f)}<input type={['material','style','mounting_type'].includes(f)?'text':'number'} step="any" value={product.specs[f]??''} onChange={e=>changeSpec(f,e.target.value)}/></label>)}
 {product.product_kind==='light'?<label className="field">Dimmable<select value={product.specs.dimmable===null||product.specs.dimmable===undefined?'unknown':String(product.specs.dimmable)} onChange={e=>changeSpec('dimmable',e.target.value==='unknown'?null:e.target.value==='true')}><option value="unknown">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></label>:null}
 </div><p>Dimensions: mm · Wattage: W · Colour temperature: K · Voltage: V. Leave unknown technical values blank.</p>
 <label className="field">Additional specifications (JSON object)<textarea value={otherSpecText} onChange={e=>setOtherSpecText(e.target.value)}/></label>
 {product.product_kind==='fixture'&&(product.specs.light_source_mode!=='replaceable'||inbuiltText.trim()!=='{}')&&<label className="field">Integrated specifications (JSON)<textarea value={inbuiltText} onChange={e=>setInbuiltText(e.target.value)}/></label>}
 <button disabled={busy} type="submit">{busy?'Working…':'Save draft'}</button><button type="button" disabled={busy} onClick={()=>void cancelEdit()}>Cancel</button>{product.id&&<p>Revision {product.revision}; saving resets approval/publication to draft.</p>}
 </fieldset></form>
:<>
 {productPanel==='overview'&&<ProductAdminView product={product} masters={masters} listings={listings} onEdit={beginEdit} onPreview={()=>setPreviewOpen(true)}/>}
 {previewOpen&&productPanel==='overview'&&<ProductPreview productId={product.id} revision={product.revision} onClose={()=>setPreviewOpen(false)} onEdit={beginEdit}/>}
 {productPanel==='configuration'&&product.id&&<ProductConfigurationPanel product={product} lightTypes={masters['light-types']||[]} onReload={async()=>{await editProduct(product.id);}}/>}
 {productPanel==='dealers'&&<> {product.id&&<section className="panel"><h2>Dealers for {product.sku}</h2>
 <form onSubmit={e=>{e.preventDefault();void performWrite(async()=>{await api('/products/'+product.id+'/dealers','POST',attach);setListings((await api('/products/'+product.id+'/dealers')).listings);setNotice('Dealer attached/updated.');});}}><div className="grid"><label className="field">Dealer<select required value={attach.dealer_id} onChange={e=>setAttach({...attach,dealer_id:e.target.value})}><option value="">Select dealer</option>{(masters.dealers||[]).filter(d=>d.is_active).map(d=><option key={d.id} value={d.id}>{d.name} ({d.dealer_code})</option>)}</select></label>{field(attach,setAttach,'dealer_sku')}{field(attach,setAttach,'minimum_order_qty','number')}{field(attach,setAttach,'lead_time_days','number')}</div><button disabled={busy}>Attach / update</button></form>
 <table><thead><tr><th>Dealer</th><th>Dealer SKU</th><th>Current INR quote</th><th/></tr></thead><tbody>{listings.map(l=><tr key={l.id}><td>{l.dealer_name}</td><td>{l.dealer_sku}</td><td>{l.net_price??'Not quoted'} {l.price_basis||''}</td><td><button disabled={busy} onClick={()=>void perform(async()=>{setQuote({...quote,listing_id:l.id});setHistory((await api('/dealer-listings/'+l.id+'/prices')).prices);})}>Quote / history</button></td></tr>)}</tbody></table>
 {quote.listing_id&&<><h3>New quote: {listings.find(l=>l.id===quote.listing_id)?.dealer_name}</h3><form onSubmit={e=>{e.preventDefault();void performWrite(async()=>{await api('/dealer-listings/'+quote.listing_id+'/prices','POST',quote);setListings((await api('/products/'+product.id+'/dealers')).listings);setHistory((await api('/dealer-listings/'+quote.listing_id+'/prices')).prices);setNotice('New effective price recorded; earlier quote retained.');});}}><div className="grid">{field(quote,setQuote,'list_price','number')}{field(quote,setQuote,'discount_percent','number')}{field(quote,setQuote,'currency')}{field(quote,setQuote,'tax_percent','number')}<label className="field">Price basis<select value={quote.price_basis} onChange={e=>setQuote({...quote,price_basis:e.target.value})}><option value="tax_exclusive">Tax exclusive</option><option value="tax_inclusive">Tax inclusive</option></select></label></div><p>Net price is calculated on the server. New quote starts now; scheduled and tiered offers are not supported here.</p><button disabled={busy}>Record price</button></form>
 <div className="scroll"><table><thead><tr><th>Currency</th><th>List</th><th>Discount %</th><th>Net</th><th>Basis</th><th>From</th><th>To</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{h.currency}</td><td>{h.list_price}</td><td>{h.discount_percent}</td><td>{h.net_price}</td><td>{h.price_basis}</td><td>{h.valid_from}</td><td>{h.valid_to||'Open'}</td></tr>)}</tbody></table></div></>}
 </section>}</>}
 {productPanel==='review'&&product.id&&<ProductReviewPanel key={product.id} mode="product" productId={product.id} productRevision={product.revision} parentBusy={busy} onBusyChange={setReviewBusy} onChanged={changedSelected} onOpenProduct={(id,view)=>openProduct(id,view?'view':'edit')}/>}
 </>}
 </>}
 </>}
 </>}

 </main>;
}
