import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "../components/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeArena 2.0 — Gamified Competitive Programming Platform",
  description: "A gamified competitive programming platform for college students. Practice algorithms, compete in real-time arenas, and run Python and C++ code with Judge0.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span>CodeArena 2.0</span> • Built for College Competitive Programmers
            </div>
            <div className="flex items-center gap-4 text-zinc-400">
              <span>Python & C++</span>
              <span>•</span>
              <span>Judge0 CE Integration Ready</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
