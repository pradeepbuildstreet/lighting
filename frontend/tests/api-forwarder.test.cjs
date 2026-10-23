const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
(async () => {
 const {forwardApi} = await import('../lib/api-forwarder.mjs');
 const counts = {};
 const server = http.createServer(async (req,res) => {
  const path = req.url.split('?')[0]; counts[path]=(counts[path]||0)+1;
  const chunks=[]; for await (const c of req) chunks.push(c); const raw=Buffer.concat(chunks);
  const json = (data,status=200) => {res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  if(path==='/api/empty'){res.setHeader('Content-Type','application/json');res.end();return;}
  if(path==='/api/bad'){res.setHeader('Content-Type','application/json');res.end('{');return;}
  if(path==='/api/slow'){setTimeout(()=>json({ok:true}),150);return;}
  if(path==='/api/gzip'){const b=zlib.gzipSync(Buffer.from(JSON.stringify({ok:true})));res.setHeader('Content-Type','application/json');res.setHeader('Content-Encoding','gzip');res.setHeader('Content-Length',b.length);res.end(b);return;}
  if(path==='/api/cookies'){res.setHeader('Set-Cookie',['session=token; HttpOnly; Secure; SameSite=Strict; Path=/','old=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/']);json({ok:true});return;}
  if(path==='/api/logout'){res.statusCode=204;res.end();return;}
  if(path==='/api/head'){res.setHeader('Content-Length','123');res.end();return;}
  if(path==='/api/not-modified'){res.statusCode=304;res.setHeader('ETag','"same"');res.end();return;}
  if(path==='/api/binary'){res.setHeader('Content-Type','application/octet-stream');res.end(Buffer.from([0,255,1,128]));return;}
  if(path==='/api/range'){res.statusCode=206;res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Range','bytes 0-2/6');res.end('abc');return;}
  if(path==='/api/redirect'){res.statusCode=302;res.setHeader('Location','http://127.0.0.1:'+server.address().port+'/api/echo?next=1');res.end();return;}
  if(path==='/api/auth-fail'){json({error:'Unauthorized'},401);return;}
  json({method:req.method,url:req.url,cookie:req.headers.cookie||null,origin:req.headers.origin||null,contentType:req.headers['content-type']||null,raw:raw.toString('base64'),hop:req.headers['x-hop']||null,id:req.headers['x-diagnostic-id']});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const options={origin:'http://127.0.0.1:'+server.address().port,allowLocalHttp:true};
 const call=(path,init={},extra={})=>forwardApi(new Request('https://luminoza.in'+path,init),{...options,...extra});
 let passed=0;
 try {
  let r=await call('/api/echo?q=a%20b',{headers:{Cookie:'session=secret',Origin:'https://luminoza.in',Connection:'keep-alive, X-Hop','X-Hop':'drop'}});let j=await r.json();assert.equal(j.url,'/api/echo?q=a%20b');assert.equal(j.cookie,'session=secret');assert.equal(j.origin,'https://luminoza.in');assert.equal(j.hop,null);assert.equal(r.headers.get('x-api-proxy'),'buffered-json-v1');passed++;
  for(const method of ['POST','PUT','PATCH','DELETE']){r=await call('/api/echo',{method,headers:{'Content-Type':'application/json'},body:'{"v":1}'});j=await r.json();assert.equal(j.method,method);assert.equal(Buffer.from(j.raw,'base64').toString(),'{"v":1}');passed++;}
  const form=new FormData();form.set('file',new Blob([new Uint8Array([0,255,10])]),'test.bin');r=await call('/api/echo',{method:'POST',body:form});j=await r.json();assert.match(j.contentType,/multipart\/form-data; boundary=/);assert(Buffer.from(j.raw,'base64').includes(Buffer.from([0,255,10])));passed++;
  r=await call('/api/gzip');assert.deepEqual(await r.json(),{ok:true});assert.equal(r.headers.get('content-encoding'),null);assert.equal(r.headers.get('content-length'),null);passed++;
  r=await call('/api/cookies');assert.equal(r.headers.getSetCookie().length,2);assert.match(r.headers.getSetCookie()[1],/Expires=Thu, 01 Jan/);await r.text();passed++;
  r=await call('/api/logout',{method:'POST'});assert.equal(r.status,204);assert.equal(await r.text(),'');passed++;
  r=await call('/api/head',{method:'HEAD'});assert.equal(r.headers.get('content-length'),'123');assert.equal(await r.text(),'');passed++;
  r=await call('/api/not-modified');assert.equal(r.status,304);assert.equal(await r.text(),'');passed++;
  r=await call('/api/binary');assert.deepEqual(Buffer.from(await r.arrayBuffer()),Buffer.from([0,255,1,128]));passed++;
  r=await call('/api/range',{headers:{Range:'bytes=0-2'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-2/6');assert.equal(await r.text(),'abc');passed++;
  r=await call('/api/empty',{method:'POST'});assert.equal(r.status,502);assert.match((await r.json()).error,/Verify saved state/);assert.equal(counts['/api/empty'],1);passed++;
  r=await call('/api/bad');assert.equal(r.status,502);assert.match((await r.json()).error,/invalid JSON/);passed++;
  r=await call('/api/slow',{}, {timeoutMs:20});assert.equal(r.status,504);await r.text();passed++;
  r=await call('/api/echo',{}, {maxJsonBytes:4});assert.equal(r.status,502);assert.match((await r.json()).error,/response limit/);passed++;
  r=await call('/api/redirect');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/api/echo?next=1');await r.text();passed++;
  r=await call('/api/auth-fail');assert.equal(r.status,401);assert.equal((await r.json()).error,'Unauthorized');passed++;
  r=await call('/api/echo',{method:'OPTIONS'});assert.equal((await r.json()).method,'OPTIONS');passed++;
  r=await call('/api/echo',{}, {origin:'http://example.com',allowLocalHttp:true});assert.equal(r.status,503);await r.text();passed++;
  console.log(JSON.stringify({passed,scope:'local Node HTTP integration tests; no Next.js build or Hostinger integration executed'}));
 } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
