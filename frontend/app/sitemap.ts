import type {MetadataRoute} from 'next';
import {deliverySitemap} from '@/lib/seo-delivery/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{return deliverySitemap();}
