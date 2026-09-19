import type { Metadata } from "next";
import { Suspense } from "react";
import { CancelDeletionView } from "@/components/account-deletion/CancelDeletionView";

export const metadata: Metadata = {
  title: "Keep your account | Hook",
  robots: { index: false, follow: false },
};

export default function CancelDeletionPage() {
  return (
    <Suspense fallback={null}>
      <CancelDeletionView />
    </Suspense>
  );
}
