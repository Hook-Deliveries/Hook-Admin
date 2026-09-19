"use client";

import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { HookLoader } from "@/components/shared/HookLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/lib/query";
import { apiPatch } from "@/lib/api";
import { cleanError, type Page } from "@/lib/admin-utils";

type DeletionRequest = { id:string; status:string; reason?:string; coolingOffUntil:string; paused?:boolean; source?:string; deferReason?:string; user?:{ email?:string; firstName?:string; lastName?:string } };
export default function SupportPage(){
  const query=useApiQuery<Page<DeletionRequest>>(["admin","deletion-requests"],"/admin/support/deletion-requests?limit=50");
  async function update(id:string,action:"pause"|"resume"|"cancel"|"erase_now"){if(action==="erase_now"&&!window.confirm("Erase this account now? This permanently deletes their personal data and cannot be undone."))return;try{await apiPatch(`/admin/support/deletion-requests/${id}`,{action});toast.success("Deletion request updated");query.refetch();}catch(error){toast.error(cleanError(error));}}
  return <div className="w-full space-y-5 px-4 py-5"><PageHeader title="Support Operations" description="Customer account deletions. Erasure runs automatically when the cooling-off period ends; pause, cancel or erase early from here."/>
    <Card className="rounded-lg py-0 shadow-card"><CardContent className="p-0">{query.isLoading&&<div className="p-12"><HookLoader label="Loading support requests..."/></div>}{!query.isLoading&&!(query.data?.data||[]).length&&<div className="p-12 text-center"><ShieldCheck className="mx-auto mb-3 text-zinc-300"/><p className="font-medium">No deletion requests</p><p className="text-sm text-zinc-500">Customer support requests will appear here.</p></div>}{(query.data?.data||[]).map(item=><div key={item.id} className="border-b p-4 last:border-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.user?.email||"Customer account"}</p><p className="mt-1 max-w-xl text-sm text-zinc-500">{item.reason||"No reason supplied"}</p><p className="mt-1 text-xs text-zinc-400">{item.status==="cooling_off"?"Erases automatically on ":"Cooling off until "}{new Date(item.coolingOffUntil).toLocaleString()}{item.source?` · requested via ${item.source}`:""}{item.paused?" · PAUSED":""}</p>{item.deferReason&&<p className="mt-1 text-xs text-amber-600">Deferred: {item.deferReason}</p>}</div><StatusBadge status={item.paused?"paused":item.status}/></div>{["cooling_off","requested","identity_verified","approved"].includes(item.status)&&<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>update(item.id,item.paused?"resume":"pause")}>{item.paused?"Resume erasure":"Pause erasure"}</Button><Button size="sm" variant="outline" onClick={()=>update(item.id,"cancel")}>Cancel request &amp; restore account</Button><Button size="sm" variant="destructive" onClick={()=>update(item.id,"erase_now")}>Erase now</Button></div>}</div>)}</CardContent></Card>
  </div>;
}
