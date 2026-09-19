import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "Hook | Admin Dashboard",
  description: "Operations dashboard for the Hook marketplace network.",
  // Apple's own web-app meta tags aren't part of the Web Manifest spec, so
  // they're set here rather than in app/manifest.ts. Shared across every
  // portal (there's only one root layout) — harmless for admin since it
  // never triggers an install prompt regardless of these tags being present.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hook",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FFC809",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full font-sans antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
