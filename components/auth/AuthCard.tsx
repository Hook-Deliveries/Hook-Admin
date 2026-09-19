import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HookLogo } from "@/components/shared/HookLogo";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
  /** Renders a "Back to login" affordance under the form. */
  backHref?: string;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The form column of every auth screen: logo, heading and form, centred.
 * Deliberately plain. An earlier version drew hairline frames and corner marks
 * with negative insets, which overflowed the container and caused horizontal
 * scroll and repaint glitches. Structure comes from spacing and type instead.
 */
export function AuthCard({ title, description, children, backHref, footer, className }: AuthCardProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-sm flex-col gap-8 animate-in fade-in-50 duration-300", className)}>
      <div className="flex flex-col items-center gap-5 text-center">
        <HookLogo className="text-4xl" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>

      {children}

      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to login
        </Link>
      )}

      {footer}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        By continuing you agree to Hook&apos;s{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href="/terms">Terms of Service</a>{" "}
        and{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href="/privacy">Privacy Policy</a>.
      </p>
    </div>
  );
}
