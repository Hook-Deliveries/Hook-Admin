import { redirect } from 'next/navigation';

export default function AppReleasesPage() {
  redirect('/dashboard/settings?section=app-updates');
}
