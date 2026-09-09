import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Freight Intelligence · SIH26006",
  description:
    "Intelligent Freight Forecasting & Vessel Chartering Decision Platform - SIH26006 prototype for overseas-to-East-Coast-India bulk cargo procurement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-base-950 font-sans text-base-100 antialiased">
        <Nav />
        <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
