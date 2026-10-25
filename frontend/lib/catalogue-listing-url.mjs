const LISTING=/^(?:\/products|\/categories\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/;
export function cleanListingHref(href){
 if(typeof href!=='string'||!href.startsWith('/')||href.startsWith('//')||href.includes('\\'))throw new Error('Expected an internal catalogue listing URL');
 const url=new URL(href,'https://listing.invalid');
 if(url.origin!=='https://listing.invalid'||url.hash||!LISTING.test(url.pathname))throw new Error('Expected an internal catalogue listing URL');
 const q=new URLSearchParams(url.searchParams),seen=new Set();
 for(const [key] of q){if(seen.has(key))throw new Error('Repeated listing parameter');seen.add(key);}
 for(const [key,value] of [['sort','name'],['page','1'],['limit','20']])if(q.get(key)===value)q.delete(key);
 if(url.pathname.startsWith('/categories/')&&q.get('category')===url.pathname.split('/').at(-1))q.delete('category');
 return url.pathname+(q.size?'?'+q.toString():'');
}
