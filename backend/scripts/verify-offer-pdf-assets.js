"use strict";
const fs=require('node:fs'),path=require('node:path');
async function main(){
 const args=process.argv.slice(2);if(args.length!==0&&(args.length!==2||args[0]!=='--output'))throw Error('Usage: [--output NEW_PDF_PATH]');
 const {readSiteLogo,renderSiteLogo}=require('../services/offer-logo'),PDFDocument=require('pdfkit'),svg=await readSiteLogo();
 const doc=new PDFDocument({size:'A4',margin:42}),chunks=[];
 const finished=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',resolve);doc.on('error',reject);});
 renderSiteLogo(doc,svg);doc.font('Helvetica').fontSize(11).text('Website-logo rendering check',42,110);doc.end();await finished;
 const bytes=Buffer.concat(chunks);if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('No PDF generated');
 if(args.length){const file=path.resolve(args[1]);fs.writeFileSync(file,bytes,{flag:'wx'});console.log('Review the generated logo PDF visually:',file);}
 console.log('Actual PDFKit/SVG renderer smoke check passed:',bytes.length,'bytes. This does not test saved-offer DB/media access.');
}
main().catch(e=>{console.error('PDF assets check failed:',e.message);process.exitCode=1;});
