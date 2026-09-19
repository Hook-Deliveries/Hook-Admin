import { redirect } from "next/navigation";

export default function Home() {
  // /launch resolves the right destination per role (staff → /dashboard,
  // Market Associate/Partner → their own dashboard) and shows a real
  // "under maintenance" screen if the backend is unreachable, instead of
  // this silently landing on a dead admin dashboard.
  redirect("/launch");
}
 