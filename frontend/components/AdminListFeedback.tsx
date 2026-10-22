"use client";
import Link from 'next/link';
export function AdminListFeedback({loading,error,retry}:{loading:boolean;error:string;retry:()=>void}){return <>{loading&&<p role="status">Loading…</p>}{error&&<p className="manager-error" role="alert">{error} <button type="button" onClick={retry}>Retry</button> · <Link href="/admin/login">Admin sign in</Link></p>}</>;}
export function AdminPagination({page,pages,onChange}:{page:number;pages:number;onChange:(page:number)=>void}){return pages>1?<nav className="admin-pagination" aria-label="Result pages"><button type="button" disabled={page===1} onClick={()=>onChange(page-1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page===pages} onClick={()=>onChange(page+1)}>Next</button></nav>:null;}
