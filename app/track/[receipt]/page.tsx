import { ParcelTracking } from "@/components/fulfilment/ParcelTracking";

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ receipt: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { receipt } = await params;
  const { s } = await searchParams;
  return <ParcelTracking receipt={decodeURIComponent(receipt)} signature={s || ""} />;
}
