export type ViewKey = "front" | "side" | "back";
export const VIEWS: ViewKey[] = ["front", "side", "back"];

export type ItemChecks = { productMatches: boolean; sizeMatches: boolean; colorMatches: boolean; quantityMatches: boolean };
export const EMPTY_CHECKS: ItemChecks = { productMatches: false, sizeMatches: false, colorMatches: false, quantityMatches: false };

export type ItemVerification = {
  orderItemId: string;
  photoUrl?: string;
  photos?: Array<{ view: ViewKey; url: string; assetId?: string }>;
  actualColor?: string;
  actualSize?: string;
  actualQuantity?: number;
  unitCostMinor?: number;
  supplierReference?: string;
  conditionNote?: string;
  matched: boolean;
  checks?: ItemChecks;
};

export type TaskItem = {
  id?: string;
  _id?: string;
  productSnapshot?: { title?: string; images?: string[] };
  productTitle?: string;
  productImage?: string;
  quantity?: number;
  selectedVariants?: { color?: string; size?: string };
  variantSnapshot?: { color?: string; size?: string; name?: string };
};

export type Task = {
  id?: string;
  publicId?: string;
  orderId?: string;
  orderPublicId?: string;
  marketId?: string;
  status?: string;
  version?: number;
  items?: TaskItem[];
  itemVerifications?: ItemVerification[];
  package?: { scanCredential?: string; credentialUnavailable?: boolean; publicId?: string; labelReference?: string; status?: string; handedOverAt?: string; credentialVerifiedAt?: string };
  hub?: { name?: string; publicId?: string };
  market?: { name?: string };
  issues?: Array<{ orderItemId?: string; status?: string; type?: string }>;
};

export const itemId = (item: TaskItem) => item.id || item._id || "";
export const itemLabel = (item: TaskItem) => item.productSnapshot?.title || item.productTitle || "Product item";
export const itemReferencePhoto = (item: TaskItem) => item.productImage || item.productSnapshot?.images?.[0];
export const orderedColor = (item: TaskItem) => item.selectedVariants?.color || item.variantSnapshot?.color || "";
export const orderedSize = (item: TaskItem) => item.selectedVariants?.size || item.variantSnapshot?.size || "";

export const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const SOURCING_STATUSES = ["ACCEPTED", "SOURCING", "PRODUCT_SECURED", "PACKING"];

/** The four milestones the associate sees, and which one the task is at. */
export const STEPS = ["Accept", "Source & verify", "Hand to Hub", "Received"] as const;
export function stepIndex(status?: string) {
  if (!status || status === "ALERTED") return 0;
  if (SOURCING_STATUSES.includes(status) || status === "BLOCKED") return 1;
  if (status === "READY_FOR_HUB") return 2;
  return 3;
}

export const ACTIONS: Record<string, { label: string; action: string }> = {
  ALERTED: { label: "Accept task", action: "accept" },
  ACCEPTED: { label: "Submit fulfilment", action: "submit" },
  SOURCING: { label: "Submit fulfilment", action: "submit" },
  PRODUCT_SECURED: { label: "Submit fulfilment", action: "submit" },
  PACKING: { label: "Submit fulfilment", action: "submit" },
};

export const ISSUE_TYPES = [
  { value: "PRODUCT_UNAVAILABLE", label: "Product unavailable" },
  { value: "COLOR_UNAVAILABLE", label: "Colour unavailable" },
  { value: "SIZE_UNAVAILABLE", label: "Size unavailable" },
  { value: "INSUFFICIENT_QUANTITY", label: "Not enough stock" },
  { value: "DAMAGED_PRODUCT", label: "Product damaged" },
  { value: "PRICE_CHANGED", label: "Price changed" },
  { value: "WRONG_CATALOG_DETAILS", label: "Wrong catalog details" },
  { value: "OTHER", label: "Something else" },
] as const;

export const cleanError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : fallback;

export const naira = (value: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(value);
