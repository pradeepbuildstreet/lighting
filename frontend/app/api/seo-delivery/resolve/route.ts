import {NextRequest,NextResponse} from 'next/server';
import {deliveryResolve} from '@/lib/seo-delivery/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 const pathname=request.nextUrl.searchParams.get('path')||'';
 if(pathname.length>500)return NextResponse.json({redirect:null},{status:400});
 return NextResponse.json({redirect:await deliveryResolve(pathname)},{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
