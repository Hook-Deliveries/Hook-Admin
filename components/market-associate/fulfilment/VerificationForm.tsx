"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { ColorPicker } from "@/components/mobile/ColorPicker";
import { SizePicker } from "@/components/mobile/SizePicker";
import { ACTION_BAR_BUTTON, StickyActionBar } from "@/components/mobile/StickyActionBar";
import { HookLoader } from "@/components/shared/HookLoader";
import { WorkflowThumbnail } from "@/components/market-associate/WorkflowThumbnail";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { colorName, sameColor } from "@/lib/color-name";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/utils";
import { PhotoSlot } from "./PhotoSlot";
import {
  EMPTY_CHECKS, VIEWS, cleanError, itemLabel, itemReferencePhoto, naira, orderedColor, orderedSize, sameText,
  type ItemChecks, type ItemVerification, type TaskItem, type ViewKey,
} from "./types";

type Draft = {
  photos: Partial<Record<ViewKey, string>>;
  color: string; size: string; quantity: string; cost: string;
  supplierReference: string; note: string; condition: string; checks: ItemChecks;
};

const CONDITIONS = [
  { key: "new", label: "Brand new", text: "Brand new, no defects" },
  { key: "good", label: "Good", text: "Good condition" },
  { key: "minor", label: "Minor defect", text: "Minor defect: " },
  { key: "damaged", label: "Damaged", text: "Damaged: " },
] as const;

const CHECKS: Array<[keyof ItemChecks, string, string]> = [
  ["productMatches", "Right product", "It is the item that was ordered"],
  ["colorMatches", "Right colour", "Colour is as ordered"],
  ["sizeMatches", "Right size", "Size is as ordered"],
  ["quantityMatches", "Right quantity", "You have every unit ordered"],
];

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Evidence and details for one product. Built to be quick on a phone in a
 * market: prefilled from the order, checks that follow what you enter, a
 * running list of what is still missing, and a draft that survives leaving
 * the screen (photos are already uploaded, so nothing is lost).
 */
export function VerificationForm({
  taskRouteId,
  item,
  index,
  total,
  existing,
  onClose,
  onNavigate,
  onSaved,
  onReportIssue,
}: {
  taskRouteId: string;
  item: TaskItem;
  index: number;
  total: number;
  existing?: ItemVerification;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  onSaved: () => void;
  onReportIssue: () => void;
}) {
  const id = item.id || item._id || "";
  const draftKey = `hook:ma-draft:${taskRouteId}:${id}`;
  const wantedColor = orderedColor(item);
  const wantedSize = orderedSize(item);
  const wantedQuantity = item.quantity || 1;

  const [draft, setDraft] = useState<Draft>(() => {
    const fromServer: Draft = {
      photos: Object.fromEntries((existing?.photos || (existing?.photoUrl ? [{ view: "front" as ViewKey, url: existing.photoUrl }] : [])).map((photo) => [photo.view, photo.url])),
      color: existing?.actualColor || colorName(wantedColor) || "",
      size: existing?.actualSize || wantedSize,
      quantity: String(existing?.actualQuantity || wantedQuantity),
      cost: existing?.unitCostMinor != null ? String(existing.unitCostMinor / 100) : "",
      supplierReference: existing?.supplierReference || "",
      note: existing?.conditionNote || "",
      condition: "",
      // The order itself tells us what should match, so start from it.
      checks: existing?.checks || { ...EMPTY_CHECKS, colorMatches: Boolean(wantedColor) && !existing, sizeMatches: Boolean(wantedSize) && !existing, quantityMatches: !existing },
    };
    if (existing) return fromServer;
    try {
      const saved = sessionStorage.getItem(draftKey);
      return saved ? { ...fromServer, ...(JSON.parse(saved) as Partial<Draft>) } : fromServer;
    } catch {
      return fromServer;
    }
  });
  const [uploading, setUploading] = useState<ViewKey | null>(null);
  const [saving, setSaving] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  useEffect(() => {
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* private mode: the draft is a convenience */ }
  }, [draft, draftKey]);

  const quantity = Number(draft.quantity) || 0;
  const cost = Number(draft.cost) || 0;
  const allChecked = Object.values(draft.checks).every(Boolean);

  const missing = useMemo(() => {
    const list: string[] = [];
    for (const view of VIEWS) if (!draft.photos[view]) list.push(`${capitalise(view)} photo`);
    if (!draft.color) list.push("Colour");
    if (!draft.size) list.push("Size");
    if (quantity < 1) list.push("Quantity");
    if (cost <= 0) list.push("Unit cost");
    if (draft.note.trim().length < 3) list.push("Condition");
    if (!allChecked) list.push("All four checks");
    return list;
  }, [draft, quantity, cost, allChecked]);
  const ready = missing.length === 0;

  async function upload(file: File, view: ViewKey) {
    setUploading(view);
    try {
      const formData = new FormData();
      formData.append("image", await compressImage(file));
      const uploaded = await apiRequest<{ url: string; secureUrl?: string }>("/upload/image", { method: "POST", body: formData });
      setDraft((current) => ({ ...current, photos: { ...current.photos, [view]: uploaded.secureUrl || uploaded.url } }));
    } catch (error) {
      toast.error(cleanError(error, "Photo could not be uploaded. Check your connection and try again."));
    } finally {
      setUploading(null);
    }
  }

  function setField(field: "color" | "size", value: string, check: keyof ItemChecks, wanted: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      // Entering what was ordered ticks the matching check; anything else clears it.
      checks: { ...current.checks, [check]: wanted ? (check === "colorMatches" ? sameColor(value, wanted) : sameText(value, wanted)) : current.checks[check] },
    }));
  }

  function setQuantity(next: number) {
    const value = Math.max(0, Math.min(999, next));
    setDraft((current) => ({ ...current, quantity: String(value), checks: { ...current.checks, quantityMatches: value === wantedQuantity } }));
  }

  function pickCondition(key: string, text: string) {
    const previous = CONDITIONS.find((entry) => entry.key === draft.condition)?.text;
    patch({ condition: key, note: !draft.note.trim() || draft.note === previous ? text : draft.note });
  }

  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      await apiRequest(`/market-associate/fulfilments/${taskRouteId}/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          photos: VIEWS.map((view) => ({ view, url: draft.photos[view] })),
          actualColor: draft.color,
          actualSize: draft.size,
          actualQuantity: quantity,
          unitCostMinor: Math.round(cost * 100),
          supplierReference: draft.supplierReference.trim() || undefined,
          conditionNote: draft.note.trim(),
          checks: draft.checks,
        }),
      });
      try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
      toast.success("Product saved");
      onSaved();
    } catch (error) {
      toast.error(cleanError(error, "Product could not be saved"));
    } finally {
      setSaving(false);
    }
  }

  const mismatch = (entered: string, wanted: string) => Boolean(entered && wanted && !sameText(entered, wanted) && !sameColor(entered, wanted));
  const card = "mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5";
  const heading = "mb-3 text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B6B6B]";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-semibold text-[#6B6B6B] hover:bg-black/5">
          <ArrowLeft className="size-4" /> Products
        </button>
        <div className="flex items-center gap-1 text-[13px] font-semibold tabular-nums text-black">
          <button type="button" aria-label="Previous product" disabled={index === 0} onClick={() => onNavigate(-1)} className="grid size-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          {index + 1} / {total}
          <button type="button" aria-label="Next product" disabled={index === total - 1} onClick={() => onNavigate(1)} className="grid size-8 place-items-center rounded-full hover:bg-black/5 disabled:opacity-30"><ChevronRight className="size-4" /></button>
        </div>
      </div>

      <section className={cn(card, "flex items-center gap-3")}>
        <WorkflowThumbnail src={itemReferencePhoto(item)} alt={`${itemLabel(item)} ordered reference`} className="size-20 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8F8F8F]">Ordered</p>
          <h1 className="truncate text-[17px] font-bold leading-tight text-black">{itemLabel(item)}</h1>
          <p className="mt-1 text-[13px] text-[#6B6B6B]">{[colorName(wantedColor), wantedSize && `Size ${wantedSize}`, `Qty ${wantedQuantity}`].filter(Boolean).join(" · ")}</p>
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B6B6B]">Photos of what you found</h2>
          <span className="text-[12px] font-semibold tabular-nums text-[#8F8F8F]">{VIEWS.filter((view) => draft.photos[view]).length}/3</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {VIEWS.map((view) => (
            <PhotoSlot
              key={view}
              view={view}
              url={draft.photos[view]}
              uploading={uploading === view}
              disabled={saving || (uploading !== null && uploading !== view)}
              onPick={(file) => void upload(file, view)}
              onRemove={() => patch({ photos: { ...draft.photos, [view]: undefined } })}
            />
          ))}
        </div>
        <p className="mt-2.5 text-[12px] leading-5 text-[#8F8F8F]">Show the whole product in good light from each angle. Photos are shrunk automatically to save data.</p>
      </section>

      <section className={card}>
        <h2 className={heading}>What you actually found</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <ColorPicker value={draft.color} onChange={(value) => setField("color", value, "colorMatches", wantedColor)} />
            {mismatch(draft.color, wantedColor) && <p className="text-[12px] font-medium text-amber-700">Ordered: {colorName(wantedColor)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Size</Label>
            <SizePicker value={draft.size} onChange={(value) => setField("size", value, "sizeMatches", wantedSize)} />
            {mismatch(draft.size, wantedSize) && <p className="text-[12px] font-medium text-amber-700">Ordered: {wantedSize}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-qty">Quantity</Label>
            <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-input">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(quantity - 1)} className="grid h-full w-12 place-items-center text-[#555] hover:bg-black/5 active:bg-black/10"><Minus className="size-4" /></button>
              <input id="ma-qty" inputMode="numeric" value={draft.quantity} onChange={(event) => setQuantity(Number(event.target.value.replace(/\D/g, "")))} className="h-full min-w-0 flex-1 bg-transparent text-center text-base font-semibold outline-none" />
              <button type="button" aria-label="Increase quantity" onClick={() => setQuantity(quantity + 1)} className="grid h-full w-12 place-items-center text-[#555] hover:bg-black/5 active:bg-black/10"><Plus className="size-4" /></button>
            </div>
            {quantity !== wantedQuantity && <p className="text-[12px] font-medium text-amber-700">Ordered: {wantedQuantity}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ma-cost">Unit cost</Label>
            <InputGroup className="h-12 rounded-[10px]">
              <InputGroupAddon align="inline-start" className="font-semibold text-black">₦</InputGroupAddon>
              <InputGroupInput id="ma-cost" inputMode="decimal" placeholder="0.00" value={draft.cost} onChange={(event) => patch({ cost: event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1") })} />
            </InputGroup>
            {cost > 0 && quantity > 0 && <p className="text-[12px] text-[#6B6B6B]">{quantity} × {naira(cost)} = <span className="font-semibold text-black">{naira(cost * quantity)}</span></p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ma-supplier">Supplier reference <span className="font-normal text-[#8F8F8F]">(optional)</span></Label>
            <Input id="ma-supplier" className="h-12 rounded-[10px]" value={draft.supplierReference} onChange={(event) => patch({ supplierReference: event.target.value })} placeholder="Stall, receipt or vendor name" />
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className={heading}>Condition</h2>
        <div role="radiogroup" aria-label="Condition" className="flex flex-wrap gap-2">
          {CONDITIONS.map((entry) => {
            const selected = draft.condition === entry.key;
            return (
              <button key={entry.key} type="button" role="radio" aria-checked={selected} onClick={() => pickCondition(entry.key, entry.text)} className={cn("rounded-full border px-3.5 py-2 text-[13px] font-semibold transition", selected ? "border-black bg-black text-white" : "border-zinc-200 bg-white text-black hover:bg-zinc-50")}>
                {entry.label}
              </button>
            );
          })}
        </div>
        <Textarea value={draft.note} onChange={(event) => patch({ note: event.target.value })} maxLength={500} placeholder="Describe the product condition" className="mt-3 min-h-20 rounded-xl" />
        {draft.condition === "damaged" && (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-5 text-amber-700"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> If this cannot be sent to the customer, use Report issue instead of saving.</p>
        )}
      </section>

      <section className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#6B6B6B]">Confirm it matches</h2>
          <button type="button" onClick={() => patch({ checks: { productMatches: true, colorMatches: true, sizeMatches: true, quantityMatches: true } })} className="text-[12px] font-bold text-[#7A5D00] underline-offset-4 hover:underline">Mark all</button>
        </div>
        <ul className="divide-y divide-black/5">
          {CHECKS.map(([key, label, hint]) => (
            <li key={key} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <div><p className="text-[15px] font-medium text-black">{label}</p><p className="text-[12px] text-[#8F8F8F]">{hint}</p></div>
              <Switch aria-label={label} checked={draft.checks[key]} onCheckedChange={(value) => patch({ checks: { ...draft.checks, [key]: value } })} />
            </li>
          ))}
        </ul>
        {existing && !existing.matched && (
          <p className="mt-2 rounded-xl bg-red-50 p-3 text-center text-[13px] text-red-700">This product was saved earlier with a check that did not match. Update it, or report an issue.</p>
        )}
      </section>

      <div aria-live="polite" className={cn("mb-4 rounded-2xl p-4 text-[13px]", ready ? "bg-emerald-50 text-emerald-800" : "bg-[#FFF8D8] text-[#6B5200]")}>
        {ready ? (
          <p className="flex items-center gap-2 font-semibold"><Check className="size-4" strokeWidth={3} /> Everything is filled in. Ready to save.</p>
        ) : (
          <>
            <p className="font-semibold">Still needed</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((entry) => <li key={entry} className="rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-medium">{entry}</li>)}
            </ul>
          </>
        )}
      </div>

      <StickyActionBar>
        <button type="button" onClick={onReportIssue} disabled={saving} className={cn(ACTION_BAR_BUTTON, "flex flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3 font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50")}>
          <AlertTriangle className="size-4" /> Report issue
        </button>
        <button type="button" onClick={() => void save()} disabled={!ready || saving || uploading !== null} className={cn(ACTION_BAR_BUTTON, "flex flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-[#FFC809] px-3 font-bold text-black transition hover:bg-[#f0bb00] disabled:opacity-40")}>
          {saving ? <HookLoader size="button" /> : <><Check className="size-4" strokeWidth={3} /> Save product</>}
        </button>
      </StickyActionBar>
    </div>
  );
}
