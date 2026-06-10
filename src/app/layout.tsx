import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI.CoFounder — AI Agents for Startup Founders",
  description: "AI agents that learn from thousands of startups to help you build, grow, and fundraise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
