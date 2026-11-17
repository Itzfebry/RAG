import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import MotionProvider from "@/components/motion-provider";
import SmoothScroll from "@/components/smooth-scroll";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ITZ AI - Chat", template: "ITZ AI - %s" },
  description: "Personal AI Agent customized with owner knowledge, personality, and context.",
  icons: {
    icon: "/image/favicon.png",
    shortcut: "/image/favicon.png",
    apple: "/image/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full dark", geist.variable, geistMono.variable)}>
      <body className="font-sans bg-background text-foreground antialiased h-full">
        <MotionProvider>
          <SmoothScroll />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
