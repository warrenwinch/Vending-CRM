import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Barlow: sturdy and very readable on phones; the condensed cut is for headings,
// in the spirit of the Watwin artwork.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Vending CRM",
  description: "Customers, sites and machines for vending operators",
  // iPhone: open full screen from the home screen, with the time and battery
  // shown over the charcoal top bar.
  appleWebApp: { capable: true, title: "Watwin CRM", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#2f2e2c",
  viewportFit: "cover", // use the whole screen, including around the notch
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
