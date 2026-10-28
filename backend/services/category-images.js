"use strict";
const {randomUUID}=require('node:crypto');
const {uuid}=require('./public-catalogue-v1');
const MAX_BYTES=5*1024*1024;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function validateImage(data){
 if(!Buffer.isBuffer(data)||!data.length||data.length>MAX_BYTES)fail(400,'Choose a JPEG or PNG image up to 5 MB.');
 let type,width,height;
 if(data.length>=45&&data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&data.toString('ascii',12,16)==='IHDR'&&data.subarray(-12).equals(Buffer.from('0000000049454e44ae426082','hex'))){type='image/png';width=data.readUInt32BE(16);height=data.readUInt32BE(20);}
 else if(data.length>4&&data[0]===255&&data[1]===216&&data[data.length-2]===255&&data[data.length-1]===217){
  type='image/jpeg';let i=2;
  while(i<data.length-2){if(data[i++]!==255)break;while(data[i]===255)i++;const marker=data[i++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;if(i+2>data.length)break;const size=data.readUInt16BE(i);if(size<2||i+size>data.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=8){height=data.readUInt16BE(i+3);width=data.readUInt16BE(i+5);break;}i+=size;}
 }
 if(!type||!width||!height||width>10000||height>10000||width*height>20000000)fail(400,'Use a valid JPEG or PNG image, maximum 20 megapixels and 10000 pixels per side.');
 return type;
}
function expected(value){if(value==='none')return null;try{return uuid(value);}catch(_){fail(400,'Reload the image before saving.');}}
function meta(row){return row?{revision:row.revision,content_type:row.content_type,bytes:Number(row.bytes),updated_at:row.updated_at}:null;}
function createService(db,audit){
 async function metadata(id){id=uuid(id);if(!(await db.query('SELECT id FROM categories WHERE id=$1',[id])).rows.length)fail(404,'Category not found');const row=(await db.query('SELECT revision,content_type,octet_length(image_data) AS bytes,updated_at FROM category_images WHERE category_id=$1',[id])).rows[0];return {image:meta(row)};}
 async function content(id,revision){id=uuid(id);revision=uuid(revision);const row=(await db.query('SELECT content_type,image_data FROM category_images WHERE category_id=$1 AND revision=$2',[id,revision])).rows[0];if(!row)fail(404,'Category image not found');return row;}
 async function save(actor,id,expectedRevision,data){
  id=uuid(id);const prior=expected(expectedRevision),type=data===null?null:validateImage(data);
  return db.transaction(async c=>{
   await c.query("SET LOCAL statement_timeout='5s'");await db.actor(c,actor);
   if(!(await c.query('SELECT id FROM categories WHERE id=$1 FOR UPDATE',[id])).rows.length)fail(404,'Category not found');
   const old=(await c.query('SELECT revision,content_type,octet_length(image_data) AS bytes,updated_at FROM category_images WHERE category_id=$1',[id])).rows[0];
   if((old?.revision||null)!==prior)fail(409,'Category image changed elsewhere. Reload before saving.');
   let row=null;
   if(data===null)await c.query('DELETE FROM category_images WHERE category_id=$1',[id]);
   else row=(await c.query('INSERT INTO category_images(category_id,content_type,image_data,revision,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(category_id) DO UPDATE SET content_type=EXCLUDED.content_type,image_data=EXCLUDED.image_data,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING revision,content_type,octet_length(image_data) AS bytes,updated_at',[id,type,data,randomUUID(),actor.id])).rows[0];
   await audit(c,actor,'category_images',id,data===null?'delete':old?'update':'create',meta(old),meta(row));
   return {image:meta(row)};
  });
 }
 return {metadata,content,save};
}
function sendImage(res,row){return res.set({'Content-Type':row.content_type,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}).send(row.image_data);}
module.exports={createService,validateImage,sendImage,MAX_BYTES};
