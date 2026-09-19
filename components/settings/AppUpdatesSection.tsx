"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminSession, useApiQuery } from '@/lib/query';
import { apiPost } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { PageHeader } from '@/components/shared/PageHeader';
import { HookLoader } from '@/components/shared/HookLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface Release { id: string; version: string; releaseNotes: string; status: 'draft' | 'published' | 'withdrawn'; }
export function AppUpdatesSection() {
  const session = useAdminSession();
  const canView = hasPermission(session.data, 'app_releases.view');
  const canManage = hasPermission(session.data, 'app_releases.manage');
  const releases = useApiQuery<Release[]>(['admin', 'app-releases'], '/admin/app-releases', canView);
  const client = useQueryClient();
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Release[]>();
  const refresh = () => void client.invalidateQueries({ queryKey: ['admin', 'app-releases'] });
  const save = useMutation({
    mutationFn: () => apiPost('/admin/app-releases', { version: version.trim(), releaseNotes: notes.trim() }),
    meta: { successMessage: 'Update announced to app users' },
    onSuccess: () => { setCreating(false); setVersion(''); setNotes(''); refresh(); },
  });
  const withdraw = useMutation({
    mutationFn: (items: Release[]) => Promise.all(items.map((item) => apiPost(`/admin/app-releases/${item.id}/withdraw`, {}))),
    meta: { successMessage: 'Update announcement withdrawn' },
    onSuccess: () => { setWithdrawing(undefined); refresh(); },
    onError: refresh,
  });
  if (session.isLoading) return <HookLoader />;
  if (!canView) return <p role="alert">You do not have permission to view app updates.</p>;
  const groups = new Map<string, Release[]>();
  for (const release of releases.data || []) {
    if (release.status === 'draft') continue;
    const key = `${release.version}:${release.status}`;
    groups.set(key, [...(groups.get(key) || []), release]);
  }
  return <section aria-label="App updates" className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
    <PageHeader title="App Updates" description="Add a new version. Users with an older version receive an update notice in the app." actions={canManage ? <Button onClick={() => setCreating(true)}>Announce update</Button> : undefined} />
    {releases.isLoading ? <HookLoader /> : releases.isError ? <Button variant="outline" onClick={() => void releases.refetch()}>Retry</Button> : !groups.size ? <p className="py-10 text-center text-muted-foreground">No update announcements yet.</p> : <div className="grid gap-4 md:grid-cols-2">
      {[...groups].map(([key, items]) => <article key={key} className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Version {items[0].version}</h2><span className="rounded-full bg-muted px-3 py-1 text-xs">{items[0].status === 'published' ? 'Announced' : 'Withdrawn'}</span></div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{items[0].releaseNotes}</p>
        {canManage && items[0].status === 'published' && <Button className="mt-4" variant="outline" disabled={withdraw.isPending} onClick={() => setWithdrawing(items)}>Withdraw announcement</Button>}
      </article>)}
    </div>}
    <Dialog open={creating} onOpenChange={(open) => { if (!save.isPending) setCreating(open); }}>
      <DialogContent><DialogHeader><DialogTitle>Announce a new version</DialogTitle><DialogDescription>Users on older versions will see an update notice. Their phone opens the appropriate app store.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="release-version">New version</Label><Input id="release-version" autoFocus required maxLength={29} pattern="[0-9]{1,9}(\.[0-9]{1,9}){0,2}" placeholder="e.g. 1.2.0" value={version} onChange={(event) => setVersion(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="release-notes">What’s new <span className="text-muted-foreground">(optional)</span></Label><Textarea id="release-notes" maxLength={4000} placeholder="Improvements users can look forward to" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Announce after this version is available in the stores. This sends a notice; it does not upload the app.</p>
          <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setCreating(false)}>Cancel</Button><Button disabled={save.isPending || !version.trim()}>{save.isPending ? 'Announcing…' : 'Announce update'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(withdrawing)} onOpenChange={(open) => { if (!open && !withdraw.isPending) setWithdrawing(undefined); }}>
      <DialogContent><DialogHeader><DialogTitle>Withdraw this announcement?</DialogTitle><DialogDescription>Users will stop seeing this notice after their next successful update check.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={withdraw.isPending} onClick={() => setWithdrawing(undefined)}>Cancel</Button><Button disabled={withdraw.isPending} onClick={() => { if (withdrawing) withdraw.mutate(withdrawing); }}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw'}</Button></DialogFooter></DialogContent>
    </Dialog>
  </section>;
}
