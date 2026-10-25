import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Bowlby_One, Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const comic = Bowlby_One({ variable: "--font-comic", weight: "400", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-barlow", weight: ["600", "700", "800"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nema · USDT0 Yield Vault",
  description: "Deposit USDT0, hold nUSDT0, earn while you chill. The first USDT0 yield vault on Stellar.",
};

export const viewport: Viewport = {
  themeColor: "#2160ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${comic.variable} ${barlow.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <WalletProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
