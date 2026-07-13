// Root layout — Next.js App Router convention: any file named layout.tsx wraps
// every route beneath it. Since this one lives directly in src/app/, it wraps
// the entire app. It renders once per navigation; only the `children` prop
// (the matched page - currently only src/app/page.tsx) changes between routes.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// next/font/google downloads and self-hosts these fonts at build time (no
// runtime request to Google's servers), and exposes each one as a CSS custom
// property via `.variable`. Those variables are consumed in globals.css's
// `@theme inline` block, which maps them to Tailwind's `font-sans` / `font-mono`.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Next.js reads this exported object to populate <title> and
// <meta name="description"> in the document <head>. Still the default
// create-next-app placeholder values - worth customizing before demoing this.
export const metadata: Metadata = {
  title: "Customer Support + Recommendation Engine",
  description: "Built by Abhishek Singh using Next.js & AI SDK",
};

// `children` is whatever page matched the current URL. With only one route
// defined in this project, that's always src/app/page.tsx.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Both font variables are applied here at the <html> level so every
      // descendant element in the app can use them via Tailwind's font-sans/
      // font-mono classes. `antialiased` smooths font rendering on all platforms.
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
