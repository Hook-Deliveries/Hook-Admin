"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Check, MessagesSquare, Package as PackageIcon, Search, ShoppingBag, UserPlus, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HookLoader } from "@/components/shared/HookLoader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  MobileButton,
  MobileEmpty,
  MobileHeader,
  MobileRow,
  MobileSection,
} from "@/components/mobile/MobileUI";
import { BasketLine, money } from "@/components/mobile/MobileCommerce";
import { PartnerBrowseWorkspace } from "@/components/partner/PartnerBrowseWorkspace";
import { ShoppingForBanner, type SelectedCustomer } from "@/components/partner/ShoppingForBanner";
import { useSelectedCustomer } from "@/lib/use-selected-customer";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch, apiPost, apiRequest } from "@/lib/api";
import { useApiQuery } from "@/lib/query";

type Row = Record<string, unknown> & { publicId?: string; id?: string };

type CartProduct = { id?: string; title?: string; slug?: string; imageUrl?: string };
type BasketItem = {
  /** publicCartLine emits the line identifier as `id`. */
  id?: string;
  publicId?: string;
  productId?: string;
  quantity?: number;
  unitPriceMinor?: number;
  totalPriceMinor?: number;
  stateId?: string;
  product?: CartProduct;
  negotiatedQuote?: { id?: string; agreedPriceMinor?: number; originalPriceMinor?: number };
};

type StateGroup = {
  stateId: string;
  subtotalMinor: number;
  checkoutEligible: boolean;
  blockingReasons?: string[];
  itemIds?: string[];
  items?: BasketItem[];
};

type AssistedBasket = {
  items?: BasketItem[];
  itemCount?: number;
  subtotalMinor?: number;
  stateGroups?: StateGroup[];
};

type CheckoutPreview = {
  previewToken: string;
  totalMinor: number;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  couponDiscountMinor?: number;
  coupon?: { code: string; type: string; discountMinor: number };
  expiresAt: string;
};

/** Explicit labels — deriving them from camelCase produced "first Name". */
const CUSTOMER_FIELDS = [
  { key: "firstName", label: "First name", type: "text", placeholder: "Ada" },
  { key: "lastName", label: "Last name", type: "text", placeholder: "Okafor" },
  { key: "email", label: "Email address", type: "email", placeholder: "customer@example.com" },
  { key: "phone", label: "Phone number", type: "tel", placeholder: "08012345678" },
] as const;

/** The cart line id, normalized the way the mobile app does it. */
function lineId(item: BasketItem) {
  return String(item.id ?? item.publicId ?? "");
}

/** Flatten lines whether the API returns `items` or only `stateGroups`. */
function basketItems(basket?: AssistedBasket): BasketItem[] {
  if (Array.isArray(basket?.items)) return basket.items;
  return Array.isArray(basket?.stateGroups)
    ? basket.stateGroups.flatMap((group) => group.items || [])
    : [];
}

/** Resolve a group's lines by embedded items, itemIds, or stateId. */
function groupItems(basket: AssistedBasket | undefined, group: StateGroup): BasketItem[] {
  if (Array.isArray(group.items) && group.items.length) return group.items;
  const lines = basketItems(basket);
  const ids = new Set((group.itemIds || []).map(String));
  if (ids.size) return lines.filter((item) => ids.has(lineId(item)));
  return lines.filter((item) => String(item.stateId || "") === String(group.stateId || ""));
}

/** Derive groups client-side when the API omits them. */
function basketGroups(basket?: AssistedBasket): StateGroup[] {
  if (Array.isArray(basket?.stateGroups) && basket.stateGroups.length) return basket.stateGroups;
  const lines = basketItems(basket);
  if (!lines.length) return [];
  const byState = new Map<string, BasketItem[]>();
  for (const item of lines) {
    const key = String(item.stateId || "");
    byState.set(key, [...(byState.get(key) || []), item]);
  }
  return [...byState.entries()].map(([stateId, items]) => ({
    stateId,
    items,
    subtotalMinor: items.reduce((sum, item) => sum + Number(item.totalPriceMinor || 0), 0),
    checkoutEligible: true,
  }));
}

export function PartnerCommerceWorkspace({
  view,
}: {
  view: "browse" | "customers" | "basket" | "orders";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { customer: selectedCustomer, select: selectStoredCustomer, clear: clearStoredCustomer } = useSelectedCustomer();
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [checkoutPreview, setCheckoutPreview] = useState<CheckoutPreview | null>(null);
  const [checkoutGroup, setCheckoutGroup] = useState<StateGroup | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [checkoutStateId, setCheckoutStateId] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    consent: false,
  });

  const orders = useApiQuery<Row[]>(["partner", "orders"], "/partner/orders", view === "orders");
  const config = useApiQuery<{ policyVersions: Record<string, string> }>(
    ["partner", "commerce-config"],
    "/partner/commerce/config",
    view === "customers" || view === "basket",
  );
  const basket = useApiQuery<AssistedBasket>(
    ["partner", "basket", selectedCustomer?.publicId],
    selectedCustomer
      ? `/partner/customers/${selectedCustomer.publicId}/cart`
      : "/partner/customers/none/cart",
    view === "basket" && Boolean(selectedCustomer),
  );

  const lines = useMemo(() => basketItems(basket.data), [basket.data]);
  const groups = useMemo(() => basketGroups(basket.data), [basket.data]);
  const basketCount = lines.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  function selectCustomer(value: Row) {
    const publicId = String(value.publicId || value.id || "");
    if (!publicId) {
      toast.error("This customer does not have a valid Hook ID");
      return;
    }
    selectStoredCustomer({ ...value, publicId } as SelectedCustomer);
    void queryClient.invalidateQueries({ queryKey: ["partner", "basket"] });
    toast.success("Now shopping for this customer");
    router.push("/partner/browse");
  }

  function clearCustomer() {
    clearStoredCustomer();
    void queryClient.invalidateQueries({ queryKey: ["partner", "basket"] });
  }

  async function changeQuantity(item: BasketItem, quantity: number) {
    const id = lineId(item);
    if (!selectedCustomer || !id || quantity < 1 || quantity > 99) return;
    setBusyItem(id);
    try {
      await apiPatch(`/partner/customers/${selectedCustomer.publicId}/cart/items/${id}`, {
        quantity,
      });
      await queryClient.invalidateQueries({ queryKey: ["partner", "basket"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not update quantity",
      );
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(item: BasketItem) {
    const id = lineId(item);
    if (!selectedCustomer || !id) return;
    setBusyItem(id);
    try {
      await apiRequest(`/partner/customers/${selectedCustomer.publicId}/cart/items/${id}`, {
        method: "DELETE",
      });
      await queryClient.invalidateQueries({ queryKey: ["partner", "basket"] });
      toast.success("Removed from basket");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not remove this item",
      );
    } finally {
      setBusyItem(null);
    }
  }

  async function prepareCheckout(group: StateGroup, code = couponCode) {
    if (!selectedCustomer) return;
    const policyVersions = config.data?.policyVersions || {};
    if (!policyVersions.TERMS || !policyVersions.PRIVACY || !policyVersions.RETURNS) {
      toast.error("Current Hook policies are unavailable");
      return;
    }
    setCheckoutBusy(true);
    try {
      const preview = await apiPost<CheckoutPreview>(
        `/partner/customers/${selectedCustomer.publicId}/checkout/states/${group.stateId}/preview`,
        {
          deliveryMethod: "PARTNER_PICKUP",
          paymentMethod: "PREPAID",
          policyVersions,
          ...(code.trim() ? { couponCode: code.trim().toUpperCase() } : {}),
        },
      );
      setCheckoutStateId(group.stateId);
      setCheckoutPreview(preview);
      setCheckoutGroup(group);
      if (code.trim() && preview.coupon) toast.success(`Coupon ${preview.coupon.code} applied`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Checkout could not start",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  function closeCheckout() {
    setCheckoutPreview(null);
    setCheckoutStateId(null);
    setCheckoutGroup(null);
    setCouponCode("");
    setCouponInput("");
  }

  /** Re-prices the open preview with (or without) a coupon. */
  async function applyCouponToCheckout(code: string) {
    if (!checkoutGroup) return;
    setCouponCode(code);
    await prepareCheckout(checkoutGroup, code);
  }

  async function confirmCheckout() {
    if (!selectedCustomer || !checkoutPreview || !checkoutStateId) return;
    setCheckoutBusy(true);
    try {
      const order = await apiRequest<Row>(
        `/partner/customers/${selectedCustomer.publicId}/checkout/states/${checkoutStateId}/confirm`,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ previewToken: checkoutPreview.previewToken }),
        },
      );
      const orderId = String(order.publicId || order.id || "");
      const payment = await apiPost<Row>(`/partner/orders/${orderId}/payment-instructions`);
      const authorizationUrl = String(payment.authorizationUrl || "");
      closeCheckout();
      await queryClient.invalidateQueries({ queryKey: ["partner", "basket"] });
      await queryClient.invalidateQueries({ queryKey: ["partner", "orders"] });
      if (authorizationUrl) window.open(authorizationUrl, "_blank", "noopener,noreferrer");
      toast.success("Order created — share the payment link with the customer");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Order could not be created",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const result = await apiGet<{ found: boolean; customer?: Row }>(
        `/partner/customers/lookup?email=${encodeURIComponent(email.trim())}`,
      );
      setCustomer(result.customer || null);
      if (!result.found) {
        setForm((current) => ({ ...current, email: email.trim() }));
        toast.info("No account with that email — register them below");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Lookup failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const policyVersions = config.data?.policyVersions || {};
      if (!policyVersions.TERMS || !policyVersions.PRIVACY || !policyVersions.RETURNS)
        throw new Error("Current Hook policies are unavailable");
      const result = await apiPost<Row>("/partner/customers", { ...form, policyVersions });
      setCustomer(result);
      selectCustomer(result);
      toast.success("Customer registered and selected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Customer could not be created",
      );
    } finally {
      setBusy(false);
    }
  }

  if (view === "orders" && orders.isLoading) {
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- browse */
  if (view === "browse") {
    return (
      <PartnerBrowseWorkspace
        customer={selectedCustomer}
        onClearCustomer={clearCustomer}
        basketCount={basketCount}
      />
    );
  }

  /* ---------------------------------------------------------------- orders */
  if (view === "orders") {
    const rows = orders.data || [];
    return (
      <div>
        <MobileHeader
          title="Orders"
          subtitle="Orders you created at this location."
          action={
            rows.length ? (
              <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#8F8F8F]">
                {rows.length}
              </span>
            ) : undefined
          }
        />
        {rows.length ? (
          <div className="overflow-hidden rounded-[10px] bg-white px-2.5">
            {rows.map((order) => (
              <div
                key={String(order.publicId || order.id)}
                className="flex min-h-17.5 items-center gap-3 border-b border-[#D9D9D9] last:border-b-0"
              >
                <span className="grid size-7.5 shrink-0 place-items-center rounded-[5px] bg-[#EAEBE7]">
                  <PackageIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-black">
                    {String(order.publicId)}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] capitalize text-[#8F8F8F]">
                    {String(order.commercePaymentStatus || "").replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold text-black">
                    {money(Number(order.totalMinor || 0))}
                  </p>
                  <StatusBadge status={String(order.commerceStatus)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MobileEmpty
            icon={PackageIcon}
            title="No orders yet"
            description="Orders you create for customers appear here."
          />
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- basket */
  if (view === "basket") {
    if (!selectedCustomer) {
      return (
        <div>
          <MobileHeader title="Basket" subtitle="Shop on behalf of a customer." />
          <MobileEmpty
            icon={UserRound}
            title="Choose a customer first"
            description="Every assisted basket belongs to a specific customer."
            action={<MobileButton href="/partner/customers">Find a customer</MobileButton>}
          />
        </div>
      );
    }

    return (
      <div>
        <MobileHeader title="Basket" subtitle="Review, then create a prepaid order." />
        <ShoppingForBanner customer={selectedCustomer} basketCount={basketCount} onClear={clearCustomer} />

        {basket.isLoading ? (
          <div className="grid min-h-40 place-items-center">
            <HookLoader label="Loading basket" />
          </div>
        ) : !lines.length ? (
          <MobileEmpty
            icon={ShoppingBag}
            title="Basket is empty"
            description="Add products from Browse to build this customer's order."
            action={<MobileButton href="/partner/browse">Browse products</MobileButton>}
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group, index) => {
              const items = groupItems(basket.data, group);
              return (
                <div key={group.stateId || index} className="rounded-[10px] bg-white p-4">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold text-black">
                      {groups.length > 1 ? `Delivery ${index + 1}` : "Items"}
                    </p>
                    <span className="text-[14px] font-bold">{money(group.subtotalMinor)}</span>
                  </div>

                  {items.map((item) => (
                    <BasketLine
                      key={lineId(item)}
                      title={String(item.product?.title || "Product")}
                      imageUrl={item.product?.imageUrl}
                      unitPriceMinor={item.unitPriceMinor}
                      totalPriceMinor={item.totalPriceMinor}
                      quantity={Number(item.quantity || 1)}
                      negotiated={item.negotiatedQuote}
                      busy={busyItem === lineId(item)}
                      onIncrease={() => void changeQuantity(item, Number(item.quantity || 1) + 1)}
                      onDecrease={() => void changeQuantity(item, Number(item.quantity || 1) - 1)}
                      onRemove={() => void removeItem(item)}
                    />
                  ))}

                  {group.checkoutEligible === false && (
                    <p className="mt-3 rounded-[10px] bg-red-50 p-3 text-[12px] leading-5 text-red-700">
                      Needs attention before checkout: {(group.blockingReasons || []).join(", ")}
                    </p>
                  )}

                  <div className="mt-4">
                    <MobileButton
                      disabled={group.checkoutEligible === false || checkoutBusy}
                      onClick={() => void prepareCheckout(group)}
                    >
                      {checkoutBusy ? <HookLoader size="button" /> : "Continue to payment"}
                    </MobileButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog
          open={Boolean(checkoutPreview)}
          onOpenChange={(open) => { if (!open && !checkoutBusy) closeCheckout(); }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create this order?</DialogTitle>
              <DialogDescription>
                A prepaid pickup order for{" "}
                {`${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim() ||
                  selectedCustomer.email}
                . They pay Hook directly.
              </DialogDescription>
            </DialogHeader>
            {checkoutPreview && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#111]" htmlFor="partner-coupon">
                    Coupon code
                  </label>
                  {checkoutPreview.coupon ? (
                    <div className="flex items-center justify-between rounded-[10px] border border-[#FFC809] bg-[#fff9e5] px-3 py-2 text-sm">
                      <span className="font-mono font-semibold">{checkoutPreview.coupon.code}</span>
                      <MobileButton
                        variant="outline"
                        disabled={checkoutBusy}
                        onClick={() => {
                          setCouponInput("");
                          void applyCouponToCheckout("");
                        }}
                      >
                        Remove
                      </MobileButton>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="partner-coupon"
                        value={couponInput}
                        onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                        placeholder="Enter a coupon code"
                        disabled={checkoutBusy}
                      />
                      <MobileButton
                        variant="outline"
                        disabled={checkoutBusy || !couponInput.trim()}
                        onClick={() => void applyCouponToCheckout(couponInput)}
                      >
                        Apply
                      </MobileButton>
                    </div>
                  )}
                </div>
                <div className="space-y-2 rounded-[10px] bg-[#F5F5F5] p-4 text-sm">
                  <div className="flex justify-between text-[#8F8F8F]">
                    <span>Products</span>
                    <span>{money(checkoutPreview.subtotalMinor)}</span>
                  </div>
                  {Number(checkoutPreview.couponDiscountMinor || 0) > 0 && (
                    <div className="flex justify-between text-[#8F8F8F]">
                      <span>Coupon{checkoutPreview.coupon ? ` (${checkoutPreview.coupon.code})` : ""}</span>
                      <span>-{money(Number(checkoutPreview.couponDiscountMinor))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#8F8F8F]">
                    <span>Pickup fee</span>
                    <span>{money(checkoutPreview.deliveryFeeMinor)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total</span>
                    <span>{money(checkoutPreview.totalMinor)}</span>
                  </div>
                </div>
              </>
            )}
            <DialogFooter>
              <MobileButton
                variant="outline"
                disabled={checkoutBusy}
                onClick={closeCheckout}
              >
                Cancel
              </MobileButton>
              <MobileButton disabled={checkoutBusy} onClick={() => void confirmCheckout()}>
                {checkoutBusy ? <HookLoader size="button" /> : "Create order"}
              </MobileButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ------------------------------------------------------------- customers */
  const customerName =
    `${String(customer?.firstName || "")} ${String(customer?.lastName || "")}`.trim();

  return (
    <div>
      <MobileHeader title="Customers" subtitle="Find who you're shopping for, or register them." />

      {selectedCustomer && (
        <MobileSection title="Currently shopping for">
          <MobileRow
            icon={UserRound}
            label={
              `${selectedCustomer.firstName || ""} ${selectedCustomer.lastName || ""}`.trim() ||
              String(selectedCustomer.email || "Customer")
            }
            description={String(selectedCustomer.email || "")}
            value={
              <button
                type="button"
                onClick={clearCustomer}
                className="text-[13px] font-semibold text-red-600"
              >
                Change
              </button>
            }
          />
          <MobileRow
            icon={ShoppingBag}
            label="Open their basket"
            description={basketCount ? `${basketCount} item${basketCount === 1 ? "" : "s"}` : "Empty"}
            href="/partner/basket"
          />
        </MobileSection>
      )}

      <MobileSection title="Step 1 — Find the customer">
        <form onSubmit={lookup} className="space-y-3 py-4">
          <Label htmlFor="lookup-email" className="text-[13px] font-semibold">
            Their email address
          </Label>
          <div className="flex gap-2">
            <Input
              id="lookup-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@example.com"
              className="h-12 rounded-[10px]"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="shrink-0 rounded-[10px] bg-[#FFC809] px-5 text-[14px] font-bold text-black disabled:opacity-50"
            >
              {busy ? <HookLoader size="button" /> : "Find"}
            </button>
          </div>
          <p className="text-[12px] text-[#8F8F8F]">Must be their exact email address.</p>
        </form>

        {customer && (
          <div className="flex items-center gap-3 border-t border-[#D9D9D9] py-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#FFF2B8] text-[15px] font-black">
              {(customerName || String(customer.email || "?")).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{customerName || "Customer"}</p>
              <p className="truncate text-[13px] text-[#8F8F8F]">{String(customer.email || "")}</p>
            </div>
            <button
              type="button"
              onClick={() => selectCustomer(customer)}
              className="shrink-0 rounded-full bg-black px-3.5 py-2 text-[12px] font-bold text-white"
            >
              Shop for them
            </button>
          </div>
        )}
      </MobileSection>

      <MobileSection title="Step 2 — Or register a new customer">
        <form onSubmit={create} className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {CUSTOMER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`new-${field.key}`} className="text-[13px] font-semibold">
                  {field.label}
                </Label>
                <Input
                  id={`new-${field.key}`}
                  type={field.type}
                  required
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="h-12 rounded-[10px]"
                />
              </div>
            ))}
          </div>

          <label className="flex items-start gap-2.5 rounded-[10px] bg-[#F5F5F5] p-3">
            <Checkbox
              checked={form.consent}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, consent: checked === true }))
              }
              className="mt-0.5"
            />
            <span className="text-[13px] leading-5 text-black">
              I presented the current Hook terms, privacy, and returns policies, and the customer
              accepted them.
            </span>
          </label>

          <MobileButton type="submit" disabled={busy || !form.consent}>
            {busy ? <HookLoader size="button" /> : <><UserPlus size={17} /> Register customer</>}
          </MobileButton>
        </form>
      </MobileSection>

      <MobileSection title="How assisted shopping works">
        <MobileRow icon={Search} tone="neutral" label="1. Find or register the customer" />
        <MobileRow icon={ShoppingBag} tone="neutral" label="2. Add products from Browse" />
        <MobileRow icon={MessagesSquare} tone="neutral" label="3. Negotiate a price if available" />
        <MobileRow icon={Check} tone="neutral" label="4. Create the order and share payment" />
      </MobileSection>
    </div>
  );
}

