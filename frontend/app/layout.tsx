import "./globals.css";
import "./quotation-layout.css";
import type {Metadata} from 'next';
import {SiteFooter} from '@/components/SiteFooter';
import {SiteHeader} from '@/components/SiteHeader';
import {StorefrontFrame} from '@/components/StorefrontFrame';
import {SITE_ORIGIN} from '@/lib/api-base';
import {WishlistProvider} from '@/components/WishlistProvider';
export const metadata:Metadata={metadataBase:new URL(SITE_ORIGIN),title:'Luminoza | Beautiful lighting! Exuberant living!',description:'Discover decorative lighting by Luminoza. Beautiful lighting! Exuberant living!',keywords:'decorative lighting, pendant lights, wall sconces, ceiling lights, LED lamps, modern lighting'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><WishlistProvider><SiteHeader/><StorefrontFrame>{children}</StorefrontFrame><SiteFooter/></WishlistProvider></body></html>;}
