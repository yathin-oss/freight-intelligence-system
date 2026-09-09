import type { Metadata } from "next";
// Self-hosted font files (npm packages, bundled into the build - no network
// fetch at build or runtime) rather than next/font/google. This matters for
// the same reason the map ships a bundled offline basemap: the build
// shouldn't have a hard, silent dependency on live internet access to a
// third-party host, in a CI runner, an offline judging room, or anywhere
// else. Only the weights actually used by the design system are imported.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Freight Intelligence · SIH26006",
  description:
    "Intelligent Freight Forecasting & Vessel Chartering Decision Platform - SIH26006 prototype for overseas-to-East-Coast-India bulk cargo procurement.",
};

// Runs before first paint (a plain <script>, not React) so the correct
// theme class is on <html> before anything renders - otherwise the page
// would flash light-then-dark (or vice versa) for returning viewers who
// chose dark. Default is light unless localStorage says otherwise.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("sih26006-theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// suppressHydrationWarning below: the blocking script adds the "dark" class
// before React hydrates, based on localStorage - the server has no access
// to that, so a class mismatch on <html> is expected and safe to suppress
// (React still hydrates the rest of the tree normally).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-base-950 font-sans text-base-100 antialiased">
        <Nav />
        <main className="mx-auto max-w-[1680px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
