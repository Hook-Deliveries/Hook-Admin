"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CreditCard, CalendarClock, FileText, Mail, Boxes, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { CatalogAvailabilitySection } from "@/components/settings/CatalogAvailabilitySection";
import { PaymentProvidersSection } from "@/components/settings/PaymentProvidersSection";
import { EmailConfigurationSection } from "@/components/settings/EmailConfigurationSection";
import { InventorySettingsSection } from "@/components/settings/InventorySettingsSection";
import { LegalContentSection } from "@/components/settings/LegalContentSection";
import { AppUpdatesSection } from "@/components/settings/AppUpdatesSection";
import { useAdminSession } from "@/lib/query";
import { hasPermission } from "@/lib/permissions";
import { HookLoader } from "@/components/shared/HookLoader";

const settingsMenu = [
  { slug: "general", name: "General", icon: Building2 },
  { slug: "catalog-availability", name: "Catalog Availability", icon: CalendarClock },
  { slug: "inventory", name: "Inventory", icon: Boxes },
  { slug: "payment-providers", name: "Payment Providers", icon: CreditCard },
  { slug: "email-configuration", name: "Email Configuration", icon: Mail },
  { slug: "legal-content", name: "Legal Content", icon: FileText },
  { slug: "app-updates", name: "App Updates", icon: Smartphone },
] as const;

const DEFAULT_SECTION = settingsMenu[0].slug;

/** Panels with a dedicated section; anything else falls back to SettingsSection. */
const SETTINGS_PANELS: Record<string, () => React.ReactElement> = {
  "catalog-availability": () => <CatalogAvailabilitySection />,
  inventory: () => <InventorySettingsSection />,
  "payment-providers": () => <PaymentProvidersSection />,
  "email-configuration": () => <EmailConfigurationSection />,
  "legal-content": () => <LegalContentSection />,
  "app-updates": () => <AppUpdatesSection />,
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAdminSession();
  const visibleMenu = settingsMenu.filter((item) => hasPermission(session.data, item.slug === "app-updates" ? "app_releases.view" : "settings.view"));
  const requestedSection = searchParams.get("section");
  const activeSection = visibleMenu.some((item) => item.slug === requestedSection)
    ? (requestedSection as string)
    : (visibleMenu[0]?.slug ?? DEFAULT_SECTION);

  function selectSection(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", slug);
    router.replace(`/dashboard/settings?${params.toString()}`);
  }

  if (session.isLoading) return <HookLoader />;
  if (!visibleMenu.length) return <p role="alert">You do not have permission to view settings.</p>;

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Platform Settings"
        description="Manage your workspace, catalog, commerce, legal content, and app updates."
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        {/* Left Inner Navigation — horizontal scroll on mobile, vertical on lg */}
        <div className="flex overflow-x-auto gap-1 pb-1 lg:w-[220px] lg:flex-col lg:overflow-x-visible lg:pb-0 xl:w-[240px]">
          {visibleMenu.map((item) => (
            <button
              key={item.slug}
              aria-current={activeSection === item.slug ? "page" : undefined}
              onClick={() => selectSection(item.slug)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors lg:w-full lg:gap-3 lg:px-4 lg:py-3",
                activeSection === item.slug
                  ? "border border-zinc-100 bg-white font-semibold text-zinc-900 shadow-sm"
                  : "font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              <item.icon
                size={16}
                className={cn(
                  "shrink-0 lg:size-[18px]",
                  activeSection === item.slug ? "text-brand-gold" : "text-zinc-400"
                )}
              />
              <span className="whitespace-nowrap lg:whitespace-normal">{item.name}</span>
            </button>
          ))}
        </div>

        {/* Right Settings Form Area */}
        <div className="flex-1 min-w-0">
          {SETTINGS_PANELS[activeSection]?.() ?? <SettingsSection />}
        </div>
      </div>
    </div>
  );
}
