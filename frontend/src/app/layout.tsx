import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Freight Intelligence · SIH26006",
  description:
    "Intelligent Freight Forecasting & Vessel Chartering Decision Platform - SIH26006 prototype for overseas-to-East-Coast-India bulk cargo procurement.",
};

// Server always renders class="dark" (today's look, unchanged for anyone
// without a saved preference). This inline script runs before hydration and
// flips it to light if the user previously toggled - avoiding a flash of
// the wrong theme. suppressHydrationWarning is the standard, documented way
// to allow this one attribute to be mutated pre-hydration without React
// complaining (see Next.js dark-mode docs).
const THEME_INIT_SCRIPT = `try {
  var t = localStorage.getItem('theme');
  if (t === 'light') document.documentElement.classList.remove('dark');
} catch (e) {}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-base-950 font-sans text-base-100 antialiased">
        <Nav />
        <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
