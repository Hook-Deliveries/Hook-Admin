export type CouponType = "percentage" | "fixed" | "free_delivery";

export interface CouponRecord {
  id: string;
  publicId?: string;
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscountMinor?: number;
  minSubtotalMinor?: number;
  startsAt?: string;
  endsAt?: string;
  totalUsageLimit?: number;
  perUserLimit: number;
  usedCount: number;
  status: "active" | "paused";
  createdAt?: string;
}

export interface CouponRedemptionRecord {
  id: string;
  publicId?: string;
  couponCode: string;
  userId: string;
  orderId?: string;
  discountMinor: number;
  status: "applied" | "released";
  createdAt?: string;
  customer?: { name: string; email: string };
}

export interface CollectionResponse<T> {
  data: T[];
  total: number;
}

export function formatNaira(minor: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(minor || 0) / 100);
}

/** How the coupon reads on a card, given its type. */
export function couponValueLabel(coupon: CouponRecord) {
  if (coupon.type === "percentage") return `${coupon.value}% off`;
  if (coupon.type === "fixed") return `${formatNaira(coupon.value)} off`;
  return "Free delivery";
}

export function couponWindowLabel(coupon: CouponRecord) {
  const start = coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : null;
  const end = coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString() : null;
  if (start && end) return `${start} – ${end}`;
  if (end) return `Until ${end}`;
  if (start) return `From ${start}`;
  return "No time limit";
}

export function isExpired(coupon: CouponRecord) {
  return Boolean(coupon.endsAt && new Date(coupon.endsAt) < new Date());
}
