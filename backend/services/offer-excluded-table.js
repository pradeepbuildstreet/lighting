"use strict";
function renderExcludedTable(doc,items){
 if(!Array.isArray(items)||!items.length)return;
 const bottom=()=>doc.page.height-55;
 function heading(continued=false){
  doc.x=42;doc.font('Helvetica-Bold').fontSize(14).fillColor('#8c321e').text('Not available - not included in this quotation'+(continued?' (continued)':''),42,doc.y,{width:511});
  doc.moveDown(.4);doc.font('Helvetica').fontSize(10).fillColor('#333333').text('The quantities below are excluded from the quoted subtotal, discount and total. They are not priced or charged.',42,doc.y,{width:511});doc.moveDown(.7);
  const y=doc.y;doc.save().rect(42,y,511,34).fill('#fff1ec').restore();doc.font('Helvetica-Bold').fontSize(9).fillColor('#8c321e');
  for(const [text,x,width] of [['Product / SKU',50,230],['Requested',290,70],['Quoted',365,65],['Not available',435,110]])doc.text(text,x,y+10,{width,align:x===50?'left':'right'});
  doc.y=y+34;
 }
 doc.moveDown();if(doc.y+145>bottom())doc.addPage();heading();
 for(const item of items){
  const product=String(item.name||'')+'\nSKU: '+String(item.sku||'');
  const note=item.note?'Remark: '+String(item.note):'';
  doc.font('Helvetica').fontSize(10);
  const productHeight=Math.max(32,doc.heightOfString(product,{width:230}));
  const noteHeight=note?doc.heightOfString(note,{width:495})+10:0;
  const height=productHeight+noteHeight+20;
  if(doc.y+height>bottom()){doc.addPage();heading(true);}
  const y=doc.y;
  doc.save().rect(42,y,511,height).lineWidth(.5).strokeColor('#d9ded5').stroke().restore();
  doc.font('Helvetica').fontSize(10).fillColor('#222222').text(product,50,y+10,{width:230});
  doc.text(String(item.requested_quantity),290,y+10,{width:70,align:'right'});
  doc.text(String(item.available_quantity),365,y+10,{width:65,align:'right'});
  doc.font('Helvetica-Bold').fillColor('#8c321e').text(String(item.unavailable_quantity),435,y+10,{width:110,align:'right'});
  if(note)doc.font('Helvetica').fontSize(10).fillColor('#444444').text(note,50,y+productHeight+16,{width:495});
  doc.y=y+height;doc.x=42;
 }
 doc.moveDown();doc.x=42;
}
module.exports={renderExcludedTable};
