import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import { HookLogo } from "@/components/shared/HookLogo";
import { money } from "@/lib/catalog";
import { colorName } from "@/lib/color-name";

export type ReceiptData = {
  receiptNumber: string;
  generatedAt: string;
  status: "SEALED" | "PENDING_SEAL";
  order: { publicId: string; placedAt?: string };
  recipient: { name?: string; phone?: string; line1?: string; line2?: string; landmark?: string; city?: string; state?: string; postalCode?: string };
  hub?: { name?: string; address?: string };
  parcel?: { reference?: string; sealReference?: string; weightGrams?: number; dimensions?: { lengthCm: number; widthCm: number; heightCm: number }; sealedAt?: string; parcels?: number };
  items: Array<{ reference?: string; title?: string; quantity?: number; color?: string; size?: string }>;
  courier?: { code?: string; name?: string; trackingNumber?: string };
  payment?: { method?: string; collectMinor?: number };
  qr: string;
  printCount?: number;
  trackingSig?: string;
  parcelOptions?: Array<{ reference?: string; sealedAt?: string }>;
  lastPrintedAt?: string;
  shipment?: { publicId?: string; status?: string; version?: number; events?: Array<{ status?: string; at?: string; note?: string }> };
};

const date = (value?: string) =>
  value ? new Date(value).toLocaleString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <div className="mt-0.5 text-[11px] font-semibold leading-tight text-zinc-950">{children || "—"}</div>
    </div>
  );
}

/** Print-ready Hook parcel receipt. Sized by its container (A6, A4 or thermal). */
export function HookReceipt({ data, scanUrl }: { data: ReceiptData; scanUrl?: string }) {
  const { recipient: to, parcel, payment } = data;
  const address = [to.line1, to.line2, to.landmark, to.city, to.state, to.postalCode].filter(Boolean).join(", ");
  const collect = Number(payment?.collectMinor || 0);
  const totalUnits = data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const reprint = Number(data.printCount || 0) > 0;

  return (
    <div
      className="relative flex h-full flex-col bg-white text-zinc-950"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <header className="flex items-center justify-between bg-zinc-950 px-4 py-3 text-white">
        <div>
          <HookLogo className="text-3xl leading-none" markClassName="text-brand-gold" />
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-zinc-400">Parcel receipt</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-400">Receipt no.</p>
          <p className="font-mono text-sm font-bold">{data.receiptNumber}</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <section className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Order</p>
            <p className="font-mono text-xl font-black leading-tight">{data.order.publicId}</p>
            {parcel?.reference ? <p className="font-mono text-[10px] text-zinc-600">Parcel {parcel.reference}</p> : null}
            {parcel && (parcel.parcels || 0) > 1 ? <p className="text-[10px] text-zinc-600">One of {parcel.parcels} parcels</p> : null}
          </div>
          <div className="text-center">
            <QRCodeSVG value={scanUrl || data.qr} size={84} level="M" marginSize={0} />
            <p className="mt-1 text-[7px] font-semibold uppercase tracking-wider text-zinc-500">Scan to verify</p>
          </div>
        </section>

        {collect > 0 ? (
          <div className="rounded bg-zinc-950 px-3 py-2 text-center text-white">
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-brand-gold">Pay at handover</p>
            <p className="text-lg font-black">Collect {money(collect)}</p>
          </div>
        ) : null}

        <section className="rounded border-2 border-zinc-950 p-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Deliver to</p>
          <p className="mt-0.5 text-sm font-black leading-tight">{to.name || "Customer"}</p>
          <p className="text-[11px] font-semibold">{to.phone}</p>
          <p className="mt-1 text-[11px] leading-snug">{address || "Address on file"}</p>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-2 rounded bg-zinc-100 p-2.5">
          <Field label="From hub">{data.hub?.name}</Field>
          <Field label="Courier">{data.courier?.name || data.courier?.code}</Field>
          <Field label="Seal reference">{parcel?.sealReference}</Field>
          <Field label="Tracking">{data.courier?.trackingNumber}</Field>
          <Field label="Weight">{parcel?.weightGrams ? `${(parcel.weightGrams / 1000).toFixed(2)} kg` : undefined}</Field>
          <Field label="Size">
            {parcel?.dimensions ? `${parcel.dimensions.lengthCm}×${parcel.dimensions.widthCm}×${parcel.dimensions.heightCm} cm` : undefined}
          </Field>
        </section>

        <section className="min-h-0 flex-1">
          <div className="flex items-baseline justify-between border-b border-zinc-300 pb-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Contents</p>
            <p className="text-[10px] font-semibold text-zinc-600">{totalUnits} unit{totalUnits === 1 ? "" : "s"}</p>
          </div>
          <ul className="divide-y divide-zinc-200">
            {data.items.map((item, index) => (
              <li key={item.reference || index} className="flex items-start justify-between gap-2 py-1 text-[11px]">
                <span className="min-w-0">
                  <span className="font-semibold">{item.title}</span>
                  <span className="block text-[10px] text-zinc-600">
                    {[item.color ? colorName(item.color) : undefined, item.size ? `Size ${item.size}` : undefined].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 font-bold">×{item.quantity}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-center">
          <Barcode value={data.order.publicId} format="CODE128" height={34} width={1.4} fontSize={10} margin={0} displayValue background="transparent" />
        </div>

        <footer className="border-t border-zinc-300 pt-2 text-[9px] leading-snug text-zinc-500">
          <p className="font-semibold text-zinc-700">
            {data.status === "SEALED" ? `Sealed ${date(parcel?.sealedAt)}` : "Not sealed yet — print after sealing"}
          </p>
          <p>Handle with care. Open only in the presence of the recipient. Generated {date(data.generatedAt)}.</p>
        </footer>
      </div>

      {reprint ? (
        <div className="absolute right-3 top-16 -rotate-6 rounded border-2 border-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600">
          Reprint · copy {Number(data.printCount) + 1}
        </div>
      ) : null}
    </div>
  );
}
