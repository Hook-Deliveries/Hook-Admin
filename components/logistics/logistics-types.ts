export interface LogisticsProviderRecord {
  id: string;
  publicId?: string;
  code: string;
  name: string;
  logoUrl?: string;
  description?: string;
  feeMinor: number;
  status: "active" | "inactive";
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
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
