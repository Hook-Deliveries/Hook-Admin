// Row shape shared by the product list. The table UI itself was replaced by
// ProductGrid.tsx (card grid, matching the Markets page's visual language) —
// this file now only keeps the type both ProductGrid and ProductCard import.
export interface ProductRow {
  id: string;
  hookId?: string;
  title: string;
  category?: { name?: string };
  vendor?: { businessName?: string };
  images?: string[];
  sellingPrice?: number;
  quantity?: number;
  status: string;
  createdAt?: string;
  managers?: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string | null;
    role: string;
  }>;
}
