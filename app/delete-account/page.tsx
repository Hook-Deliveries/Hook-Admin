import type { Metadata } from "next";
import { DeleteAccountView } from "@/components/account-deletion/DeleteAccountView";

export const metadata: Metadata = {
  title: "Delete your account | Hook",
  description: "Request deletion of your Hook account and personal data, or cancel a request you already made.",
};

export default function DeleteAccountPage() {
  return <DeleteAccountView />;
}
