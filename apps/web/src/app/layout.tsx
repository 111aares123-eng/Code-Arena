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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F5F1E8] text-[#252D25] font-sans selection:bg-[#879B7A]/35 selection:text-[#252D25]">
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="border-t border-[#252D25]/10 bg-[#E8E2D6] py-6 text-xs text-[#526052]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#252D25]">CodeArena 2.0</span>
              <span className="text-[#879B7A]">•</span>
              <span className="text-[#526052]">Built for College Competitive Programmers</span>
            </div>
            <div className="flex items-center gap-3 text-[#526052]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#252D25]/10 bg-[#F5F1E8] text-[11px] font-mono text-[#252D25]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Python & C++
              </span>
              <span className="text-[#879B7A]">•</span>
              <span className="text-[#526052]">Judge0 CE Integration Ready</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
