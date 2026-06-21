import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI.CoFounder — AI Agents for Startup Founders",
  description: "AI agents that learn from thousands of startups to help you build, grow, and fundraise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={`${plusJakarta.variable} ${inter.variable} font-[family-name:var(--font-jakarta)]`}>
        {children}
      </body>
    </html>
  );
}
