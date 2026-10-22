"use client";
import {PublicationCompatibilityWarnings} from '@/components/PublicationCompatibilityWarnings';
export type CatalogueVisibility = {
 compatibility_warnings?:string[]; compatibility_validation?:{status:string};
 published:boolean; visible:boolean; status:'visible'|'not_visible';
 duplicate_approval_ok:boolean; reasons:string[];
};
type Props={visibility?:CatalogueVisibility; compact?:boolean; disabled?:boolean; onReview?:()=>void};
export default function ProductVisibility({visibility,compact=false,disabled=false,onReview}:Props){
 if(!visibility)return <p role="status">Customer visibility has not been checked. Reload saved product data.</p>;
 const blocked=!visibility.visible;
 return <div role="status" aria-live="polite" style={{borderLeft:`4px solid ${blocked?'#a65b00':'#28643e'}`,background:blocked?'#fff6e5':'#edf6ee',padding:compact?'8px 10px':'14px 16px',margin:'8px 0',color:'#252d27',fontSize:'14px',lineHeight:1.5}}>
  <div>Publication: {visibility.published?'Published':'Unpublished'}</div>
  <div style={{fontWeight:700}}>Customer catalogue: {visibility.visible?'Visible':'Not visible'}</div>
  <PublicationCompatibilityWarnings warnings={visibility.compatibility_warnings}/>
  {blocked&&<>
   {!compact&&visibility.published&&<p>Publication is enabled, but this product is not visible in the customer catalogue.</p>}
   <ul aria-label="Customer visibility blockers" style={{paddingLeft:'20px',listStyleType:'disc'}}>{visibility.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
   {!visibility.duplicate_approval_ok&&onReview&&<button type="button" disabled={disabled} onClick={onReview}>Review duplicates</button>}
  </>}
  {!compact&&<p>Visibility reflects saved data at the last check, not unsaved edits. Current filters can further narrow customer listings.</p>}
 </div>;
}
