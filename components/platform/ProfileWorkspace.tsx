"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Camera,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  MessagesSquare,
  Package,
  Phone,
  Store,
  ShieldCheck,
  Smartphone,
  Users,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HookLoader } from "@/components/shared/HookLoader";
import {
  MobileButton,
  MobileHeader,
  MobileRow,
  MobileSection,
} from "@/components/mobile/MobileUI";
import { ACTION_BAR_BUTTON, StickyActionBar } from "@/components/mobile/StickyActionBar";
import { APP_ACTION_BAR_CONTENT_INSET } from "@/lib/tab-bar-layout";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/lib/query";
import { apiPatch, apiPost, apiRequest, clearSession, logoutAccount } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { PORTAL_BASE_PATH } from "@/components/platform/AppTabBarShell";

/** Mirrors the backend multer filter (UPLOAD_ALLOWED_TYPES) and 5MB size limit. */
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type Account = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  operationalStateName?: string;
  lastLoginAt?: string;
};

type PortalMarketAssociateProfile = { publicId?: string; availability?: string; status?: string };
type PartnerProfile = { publicId?: string; name?: string; address?: string; status?: string };
type MarketAssociateApiResponse = { account: Account; profile: PortalMarketAssociateProfile };
type PartnerResponse = { account: Account; partner: PartnerProfile };
type MarketsResponse = { markets: Array<{ publicId: string; name: string }> };

function fullName(account?: Account) {
  const value = `${account?.firstName || ""} ${account?.lastName || ""}`.trim();
  return value || "Hook account";
}

function initials(account?: Account) {
  return ((account?.firstName?.[0] || "") + (account?.lastName?.[0] || "")).toUpperCase() || "H";
}

export function ProfileWorkspace({
  type,
  section,
}: {
  type: "marketassociate" | "partner";
  section: "profile" | "security";
}) {
  const base = PORTAL_BASE_PATH[type];
  const query = useApiQuery<MarketAssociateApiResponse | PartnerResponse>([type, "profile"], `${base}/profile`);
  const markets = useApiQuery<MarketsResponse>(
    ["marketassociate", "markets"],
    "/market-associate/markets",
    type === "marketassociate" && section === "profile",
  );

  if (query.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading profile" />
      </div>
    );
  if (query.isError || !query.data)
    return <p className="text-sm text-destructive">Unable to load your account.</p>;

  const account = query.data.account;
  const partner = type === "partner" ? (query.data as PartnerResponse).partner : undefined;
  const marketAssociateProfile = type === "marketassociate" ? (query.data as MarketAssociateApiResponse).profile : undefined;

  if (section === "security") return <SecuritySection type={type} account={account} />;

  const statusValue = marketAssociateProfile?.availability || partner?.status || marketAssociateProfile?.status;

  return (
    <div>
      <ProfileHero account={account} caption={type === "marketassociate" ? "Market Associate" : partner?.name || "Hook Partner"} />

      <MobileSection title="Account">
        <MobileRow icon={UserRound} label="Edit profile" href={`${base}/profile/edit`} />
        <MobileRow icon={ShieldCheck} label="Password & security" href={`${base}/security`} />
        <MobileRow
          icon={BadgeCheck}
          label="Status"
          tone="neutral"
          value={<span className="capitalize">{(statusValue || "-").replaceAll("_", " ")}</span>}
        />
      </MobileSection>

      <MobileSection title="Contact">
        <MobileRow
          icon={Mail}
          label="Email"
          tone="neutral"
          value={account.isEmailVerified ? "Verified" : "Unverified"}
          description={account.email}
        />
        <MobileRow
          icon={Phone}
          label="Phone"
          tone="neutral"
          value={account.isPhoneVerified ? "Verified" : "Unverified"}
          description={account.phone || "Not added"}
        />
        {account.operationalStateName && (
          <MobileRow icon={MapPin} label="Operating state" tone="neutral" description={account.operationalStateName} />
        )}
      </MobileSection>

      {type === "marketassociate" && (
        <MobileSection title="Assigned markets" action={<span className="text-[13px] text-[#8F8F8F]">{markets.data?.markets.length || 0}</span>}>
          {markets.isLoading ? (
            <div className="py-6">
              <HookLoader size="inline" />
            </div>
          ) : markets.data?.markets.length ? (
            markets.data.markets.map((market) => (
              <MobileRow key={market.publicId} icon={Store} label={market.name} href={`/market-associate/markets/${market.publicId}`} />
            ))
          ) : (
            <MobileRow icon={Store} label="No markets assigned" tone="neutral" />
          )}
        </MobileSection>
      )}

      {type === "partner" && (
        <>
          {partner && (
            <MobileSection title="Location">
              <MobileRow icon={Building2} label={partner.name || "Business"} tone="neutral" description={partner.address} />
            </MobileSection>
          )}
          <MobileSection title="Manage">
            <MobileRow icon={Users} label="Customers" description="Find or register who you're shopping for" href="/partner/customers" />
            <MobileRow icon={MessagesSquare} label="Messages" description="Price negotiations" href="/partner/messages" />
            <MobileRow icon={Package} label="Custody" description="Receive or release packages" href="/partner/fulfilment" />
          </MobileSection>
        </>
      )}

      <LogoutBlock email={account.email} />
    </div>
  );
}

function ProfileHero({ account, caption }: { account: Account; caption: string }) {
  return (
    <div className="mb-7 flex items-center px-1">
      <div className="rounded-full bg-[#FFC809] p-[3px]">
        <Avatar className="size-[68px]">
          <AvatarImage src={account.avatarUrl} alt="" />
          <AvatarFallback className="bg-[#FFF2B8] text-xl font-black text-black">
            {initials(account)}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="ml-4 min-w-0 flex-1">
        <p className="truncate text-[20px] font-bold text-black">{fullName(account)}</p>
        <p className="mt-1 truncate text-[14px] text-[#8F8F8F]">{account.email}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[#9a7400]">{caption}</p>
      </div>
    </div>
  );
}

function LogoutBlock({ email }: { email?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await logoutAccount();
    } catch {
      clearSession();
    }
    router.replace("/auth/login");
  }

  return (
    <>
      <MobileButton variant="danger" className="mt-1" onClick={() => setOpen(true)}>
        <LogOut size={19} /> Log out
      </MobileButton>
      {email && <p className="mt-3 text-center text-[11px] text-[#A0A0A3]">Signed in as {email}</p>}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of Hook?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign in again to pick up assigned work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void logout();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? <HookLoader size="button" /> : "Log out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SecuritySection({ type, account }: { type: "marketassociate" | "partner"; account: Account }) {
  const base = PORTAL_BASE_PATH[type];
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (newPassword.length < 6) return toast.error("New password must be at least 6 characters");
    setSaving(true);
    try {
      await apiPost("/auth/password/change", { currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not update password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <MobileHeader title="Security" subtitle="Password and account protection." />

      <MobileSection title="Account status">
        <MobileRow
          icon={Mail}
          label="Email verified"
          tone="neutral"
          value={account.isEmailVerified ? "Yes" : "No"}
        />
        <MobileRow
          icon={Smartphone}
          label="Phone verified"
          tone="neutral"
          value={account.isPhoneVerified ? "Yes" : "No"}
        />
        <MobileRow
          icon={ShieldCheck}
          label="Last login"
          tone="neutral"
          value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : "-"}
        />
      </MobileSection>

      <MobileSection title="Change password">
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-[13px] font-semibold">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              className="h-12 rounded-[10px]"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-[13px] font-semibold">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              className="h-12 rounded-[10px]"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
        </div>
      </MobileSection>

      <MobileButton
        onClick={() => void changePassword()}
        disabled={saving || !currentPassword || !newPassword}
      >
        {saving ? <HookLoader size="button" /> : <><KeyRound size={18} /> Update password</>}
      </MobileButton>

      <div className="mt-7">
        <MobileButton variant="outline" href={`${base}/profile`}>
          Back to profile
        </MobileButton>
      </div>
    </div>
  );
}

/** Editable profile fields (photo + phone), matching the native edit screen. */
export function ProfileEditWorkspace({ type }: { type: "marketassociate" | "partner" }) {
  const router = useRouter();
  const base = PORTAL_BASE_PATH[type];
  const queryClient = useQueryClient();
  const query = useApiQuery<MarketAssociateApiResponse | PartnerResponse>([type, "profile"], `${base}/profile`);
  const [phone, setPhone] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (query.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading profile" />
      </div>
    );
  if (query.isError || !query.data)
    return <p className="text-sm text-destructive">Unable to load your account.</p>;

  const account = query.data.account;
  const phoneValue = phone ?? account.phone ?? "";
  const avatarValue = avatarUrl ?? account.avatarUrl ?? "";

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Use a JPEG, PNG, WebP, or GIF image");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(`Image must be under ${MAX_AVATAR_BYTES / 1024 / 1024}MB`);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const asset = await apiRequest<{ secureUrl?: string; url?: string }>("/upload/image", {
        method: "POST",
        body,
      });
      const uploaded = asset.secureUrl || asset.url;
      if (!uploaded) throw new Error("Upload did not return an image URL");
      setAvatarUrl(uploaded);
      toast.success("Photo uploaded — save to apply it");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Photo could not be uploaded",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await apiPatch(`${base}/profile`, {
        phone: phoneValue.trim() || undefined,
        // Send "" (not undefined) so the backend clears a removed photo.
        ...(avatarUrl !== undefined ? { avatarUrl: avatarValue.trim() } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: [type, "profile"] });
      toast.success("Profile updated");
      router.push(`${base}/profile`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Could not update profile",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ paddingBottom: APP_ACTION_BAR_CONTENT_INSET }}>
      <MobileHeader title="Edit profile" subtitle="Update how Hook reaches you." />

      <div className="mb-7 flex flex-col items-center">
        <label className={`relative ${uploading ? "cursor-wait" : "cursor-pointer"}`}>
          <span className="block rounded-full bg-[#FFC809] p-[3px]">
            <Avatar className="size-[96px]">
              <AvatarImage src={avatarValue || undefined} alt="" />
              <AvatarFallback className="bg-[#FFF2B8] text-2xl font-black text-black">
                {initials(account)}
              </AvatarFallback>
            </Avatar>
          </span>
          <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-[3px] border-[#F5F5F5] bg-black text-white">
            {uploading ? <HookLoader size="button" variant="yellow" /> : <Camera size={16} />}
          </span>
          <input
            type="file"
            accept={ACCEPTED_AVATAR_TYPES.join(",")}
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void uploadAvatar(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <p className="mt-3 text-[13px] text-[#8F8F8F]">
          {uploading ? "Uploading photo…" : "Tap the photo to change it"}
        </p>
        {avatarValue && !uploading && (
          <button
            type="button"
            onClick={() => setAvatarUrl("")}
            className="mt-1.5 text-[13px] font-semibold text-red-600"
          >
            Remove photo
          </button>
        )}
      </div>

      <MobileSection title="Details">
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold">Name</Label>
            <Input value={fullName(account)} disabled className="h-12 rounded-[10px]" />
            <p className="text-[12px] text-[#8F8F8F]">Contact Hook operations to change your name.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold">Email</Label>
            <Input value={account.email || ""} disabled className="h-12 rounded-[10px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone" className="text-[13px] font-semibold">
              Phone
            </Label>
            <Input
              id="profile-phone"
              type="tel"
              className="h-12 rounded-[10px]"
              value={phoneValue}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 08012345678"
            />
          </div>
        </div>
      </MobileSection>

      <StickyActionBar>
        <MobileButton
          variant="outline"
          href={`${base}/profile`}
          className={cn(ACTION_BAR_BUTTON, "w-auto shrink-0 border-0 px-4")}
        >
          Cancel
        </MobileButton>
        <MobileButton
          onClick={() => void save()}
          disabled={saving || uploading}
          className={cn(ACTION_BAR_BUTTON, "flex-1")}
        >
          {saving ? <HookLoader size="button" /> : "Save changes"}
        </MobileButton>
      </StickyActionBar>
    </div>
  );
}
