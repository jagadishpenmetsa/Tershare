import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Poppins } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/index.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "TerShare — Remote terminal sharing",
  description:
    "Share your Windows terminal securely with an 8-character code. Lightweight, real-time, browser-based.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${bebasNeue.variable}`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden font-sans antialiased">
        <SiteHeader />
        <main className="flex-1 w-full min-w-0 bg-surface">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
