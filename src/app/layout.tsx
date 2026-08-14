import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

// Interface copy is English, but film titles come from creators worldwide,
// so the Greek subset is loaded alongside Latin.
const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "greek"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BAGLE FLIX — The BagleFlix of AI Generated Cinema",
    template: "%s · BAGLE FLIX",
  },
  description:
    "A subscription streaming service for films and series made entirely with AI.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
