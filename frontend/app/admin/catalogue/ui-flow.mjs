export function formSnapshot(product,other,integrated){return JSON.stringify([product,other,integrated]);}
export function referenceSnapshot(record,address){return JSON.stringify([record,address]);}
export function isDirty(current,baseline){return current!==baseline;}
export function navigationBlocked(writeBusy){return writeBusy===true;}
export function presentation(mode){return mode==='edit'?'editor':mode==='view'?'admin-view':'product-list';}
