"use strict";
const fs=require('node:fs/promises'),path=require('node:path');
const PDFDocument=require('pdfkit');
const {readSiteLogo,renderSiteLogo}=require('./offer-logo');
const {createOfferImageLoader}=require('./offer-image-cache');
const money=v=>'INR '+Number(v).toFixed(Number.isInteger(Number(v))?0:2);
async function loadImage(url,doc,mediaFile){
 try{
  if(typeof url!=='string'||!url)return null;
  if(/^\/api\/offers\/[0-9a-f]{64}\/media\/[0-9a-f-]{36}$/i.test(url)){const p=url.split('/'),m=await mediaFile(p[3],p[5]);if(m.size>4000000||!['.jpg','.png'].includes(m.ext))return null;const b=await fs.readFile(m.file);doc.openImage(b);return b;}
  const configured=(process.env.IMAGE_REPO_URL||'').trim();if(!configured)return null;
  const source=new URL(url,configured),allowed=new Set([configured,...(process.env.FRONTEND_ORIGIN||'').split(',')].filter(Boolean).map(v=>{try{return new URL(v.trim()).origin;}catch(_){return '';}}));
  if(!['https:','http:'].includes(source.protocol)||source.username||source.password||!allowed.has(source.origin))return null;
  const publicPath=decodeURIComponent(source.pathname).replace(/^\/+/,'');const root=path.resolve(process.env.IMAGE_PUBLIC_ROOT||path.join(__dirname,'../../frontend/public'));
  if(!publicPath||publicPath.includes('\0'))return null;
  const candidates=[path.resolve(root,publicPath)];if(publicPath.startsWith('uploads/'))candidates.push(path.resolve(root,'uploads',path.basename(publicPath)));
  for(const candidate of candidates){try{const realRoot=await fs.realpath(root),real=await fs.realpath(candidate);if(!real.startsWith(realRoot+path.sep))continue;const stat=await fs.stat(real);if(!stat.isFile()||stat.size>4000000)continue;const b=await fs.readFile(real);doc.openImage(b);return b;}catch(_){}}
  if(source.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(source.hostname))return null;
  const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'image/png, image/jpeg'}});
  if(!response.ok||!(response.headers.get('content-type')||'').startsWith('image/')||Number(response.headers.get('content-length')||0)>4000000||!response.body){if(response.body)await response.body.cancel();return null;}
  const reader=response.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000){await reader.cancel();return null;}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  if(!size)return null;const b=Buffer.concat(chunks,size);doc.openImage(b);return b;
 }catch(_){return null;}
}
async function createOfferPdf(offer,res,mediaFile){
 const logo=await readSiteLogo(),doc=new PDFDocument({size:'A4',margin:42,bufferPages:true});
 const image=createOfferImageLoader(url=>loadImage(url,doc,mediaFile));
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Luminoza-Price-Offer.pdf"');res.setHeader('Cache-Control','private, no-store');
 doc.on('error',e=>res.destroy(e));res.on('close',()=>{if(!res.writableEnded)doc.destroy();});doc.pipe(res);
 renderSiteLogo(doc,logo);doc.font('Helvetica').fontSize(10).fillColor('#30343a').text('Beautiful lighting! Exuberant living!',42,88);
 doc.font('Helvetica-Bold').fontSize(15).fillColor('#18382e').text('Personalized price offer',42,104);
 doc.font('Helvetica').fontSize(10).fillColor('#333333').text('Prepared for: '+(offer.customer_name||'Customer'),42,128,{width:511});
 doc.text('Offer reference: '+offer.offer_token.slice(0,12).toUpperCase()+' | Version '+offer.version);
 doc.text('Created: '+new Date(offer.created_at).toLocaleDateString('en-IN'));
 if(offer.expires_at)doc.text('Valid until: '+new Date(offer.expires_at).toLocaleDateString('en-IN',{timeZone:'UTC'}));
 doc.text('9600096298 | 8124969000 | pradeep33.tcs@gmail.com');
 if(offer.is_partial)doc.text('PARTIAL AVAILABILITY: totals cover available quantities only. See excluded items below.');
 doc.moveDown();
 const room=h=>{if(doc.y+h>doc.page.height-55){doc.addPage();doc.x=42;}};
 function header(){const y=doc.y;doc.font('Helvetica-Bold').fontSize(9).fillColor('#18382e');for(const [t,x,w] of [['Product',98,105],['Qty',211,28],['List price',246,75],['Discount',328,55],['Offer price',390,74],['Line total',471,82]])doc.text(t,x,y,{width:w,align:x===98?'left':'right'});doc.y=y+25;}
 header();
 for(const item of offer.items){
  const label=item.requested_quantity>item.quantity?`\nPart quantity available: ${item.quantity} of ${item.requested_quantity}`:'';
  const text=item.name+'\nSKU: '+item.sku+label;
  doc.font('Helvetica').fontSize(9);const height=Math.max(54,doc.heightOfString(text,{width:105})+8);
  if(doc.y+Math.min(height,600)>doc.page.height-60){doc.addPage();header();}
  const y=doc.y,b=await image(item.image_url);doc.font('Helvetica').fontSize(9).fillColor('#222222');
  if(b)doc.image(b,42,y,{fit:[48,48],align:'center',valign:'center'});else doc.rect(42,y,48,48).strokeColor('#d9ded5').stroke();
  doc.text(text,98,y,{width:105});
  for(const [t,x,w] of [[String(item.quantity),211,28],[money(item.list_price),246,75],[item.discount_percent+'%',328,55],[money(item.offer_price),390,74],[money(item.offer_price*item.quantity),471,82]])doc.text(t,x,y,{width:w,align:'right'});
  doc.y=y+height;doc.moveTo(42,doc.y).lineTo(553,doc.y).strokeColor('#e1e6df').stroke();doc.moveDown(.5);
  if(item.availability_note){room(35);doc.font('Helvetica').fontSize(9).text('Availability remark: '+item.availability_note,42,doc.y,{width:511});doc.moveDown(.5);}
 }
 room(90);doc.x=42;doc.fontSize(10);
 for(const [label,value] of [['Subtotal at list prices',money(offer.list_total)],['Discount offered ('+offer.discount_percent+'%)','- '+money(offer.savings)],['Offer total',money(offer.offer_total)]]){const y=doc.y;doc.font(label==='Offer total'?'Helvetica-Bold':'Helvetica').text(label,42,y,{width:350});doc.text(value,392,y,{width:161,align:'right'});doc.y=y+18;}
 doc.moveDown();
 const terms=offer.terms||{},termsList=[['GST / tax',terms.gst],['Payment terms',terms.payment_terms],['Account / payment details',terms.payment_details],['Estimated delivery',terms.delivery_days?terms.delivery_days+' days':''],['Additional terms',terms.other_terms]].filter(([,v])=>v);
 if(termsList.length){room(50);doc.font('Helvetica-Bold').fontSize(12).text('Terms and conditions',42,doc.y,{width:511});for(const [label,value] of termsList){room(45);doc.font('Helvetica-Bold').fontSize(9).text(label+':',42,doc.y,{width:511});doc.font('Helvetica').text(String(value),42,doc.y,{width:511});doc.moveDown(.3);}}
 room(100);doc.font('Helvetica-Bold').fontSize(11).text('Visit our showrooms',42,doc.y,{width:511});doc.font('Helvetica').fontSize(9);
 doc.text('LED Zone - No 10, Ratan Bazaar, Evening Bazaar, Tamil Nadu',42,doc.y,{width:511,link:'https://maps.app.goo.gl/t5Sg3MG2oLgyoBX26',underline:true});
 doc.text('HomeStory - 1/348, East Coast Rd, Anna Enclave, Injambakkam, Chennai, Tamil Nadu 600115',42,doc.y,{width:511,link:'https://share.google/jrM4UJC2TDh3p9sga',underline:true});
 if(offer.unavailable_items&&offer.unavailable_items.length){
  doc.moveDown();room(85);doc.font('Helvetica-Bold').fontSize(12).text('Unavailable / excluded from this quotation',42,doc.y,{width:511});
  doc.font('Helvetica').fontSize(10).text('These quantities are NOT included in the subtotal, discount or offer total.',42,doc.y,{width:511});doc.moveDown(.5);
  for(const item of offer.unavailable_items){const text=`${item.name} | SKU: ${item.sku}\nRequested: ${item.requested_quantity} | Quoted: ${item.available_quantity} | Unavailable / excluded: ${item.unavailable_quantity}`+(item.note?'\nRemark: '+item.note:'');doc.font('Helvetica').fontSize(9);room(Math.min(doc.heightOfString(text,{width:511})+12,650));doc.text(text,42,doc.y,{width:511});doc.moveDown(.6);}
 }
 doc.end();
}
module.exports={createOfferPdf,loadImage};
