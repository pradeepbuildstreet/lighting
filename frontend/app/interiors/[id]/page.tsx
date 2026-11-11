'use client';
import {useParams} from 'next/navigation';
import {InteriorCustomer} from '@/components/InteriorCustomer';
export default function InteriorDesignPage(){const params=useParams();const id=typeof params?.id==='string'?params.id:undefined;return id?<InteriorCustomer designId={id}/>:<p>Invalid interior design.</p>;}
