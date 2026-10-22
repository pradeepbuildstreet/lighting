import {NextRequest,NextResponse} from 'next/server';
export async function deliveryResponse(request:NextRequest){
 if(process.env.SEO_INTEGRATION_DISABLED==='true'){ return NextResponse.next(); }

 if(!request.nextUrl.pathname.startsWith('/products/')&&!request.nextUrl.pathname.startsWith('/legacy-products/'))return NextResponse.next();
 if(!['GET','HEAD'].includes(request.method))return NextResponse.next();
 try{
  const configured=process.env.SEO_DELIVERY_FRONTEND_ORIGIN||process.env.SITE_URL||process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3001';const site=new URL(configured);
  if(!['http:','https:'].includes(site.protocol)||site.username||site.password||site.pathname!=='/'||site.search||site.hash)return NextResponse.next();
  if(site.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(site.hostname))return NextResponse.next();
  const endpoint=new URL('/api/seo-delivery/resolve',site.origin);endpoint.searchParams.set('path',request.nextUrl.pathname);
  const r=await fetch(endpoint,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});
  if(r.ok){const d=await r.json();if(d.redirect?.status===307&&typeof d.redirect.path==='string'&&d.redirect.path.startsWith('/catalogue/products/')&&!d.redirect.path.startsWith('//')&&!/[\\?#]/.test(d.redirect.path)){
   const url=new URL(d.redirect.path,site.origin);const response=NextResponse.redirect(url,307);response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex');return response;
  }}
 }catch{}
 return NextResponse.next();
}
