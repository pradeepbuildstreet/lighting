"use strict";
const fs=require('node:fs/promises'),path=require('node:path');
function validateLogo(svg){
 if(typeof svg!=='string'||Buffer.byteLength(svg)>1000000||!/<svg[\s>]/i.test(svg)||/<!DOCTYPE|<!ENTITY|<(?:script|foreignObject|image)\b|@import|\bon\w+\s*=|\bxml:base\s*=/i.test(svg))throw Error('Website logo must be a self-contained SVG, without scripts/external resources');
 for(const match of svg.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/gi))if(!match[1].startsWith('#'))throw Error('External SVG references are unsupported');
 for(const match of svg.matchAll(/url\(([^)]*)\)/gi)){const ref=match[1].trim().replace(/^["']|["']$/g,'');if(!ref.startsWith('#'))throw Error('External SVG resources are unsupported');}
 return svg;
}
async function readSiteLogo(){return validateLogo(await fs.readFile(path.resolve(__dirname,'../assets/luminoza-site-logo.svg'),'utf8'));}
function renderSiteLogo(document,svg){const SVGtoPDF=require('svg-to-pdfkit');document.save();try{SVGtoPDF(document,validateLogo(svg),42,40,{width:270,height:46,preserveAspectRatio:'xMinYMid meet'});}finally{document.restore();}}
module.exports={validateLogo,readSiteLogo,renderSiteLogo};
