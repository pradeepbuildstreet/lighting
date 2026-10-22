import type {MetadataRoute} from 'next';
import {deliveryRobots} from '@/lib/seo-delivery/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function robots():Promise<MetadataRoute.Robots>{return deliveryRobots();}
