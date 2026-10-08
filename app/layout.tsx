import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ITZ AI - Chat", template: "ITZ AI - %s" },
  description: "Personal AI Agent customized with owner knowledge, personality, and context.",
  icons: { icon: "/image/favicon.png", shortcut: "/image/favicon.png", apple: "/image/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full dark", montserrat.variable)}>
      <body className="font-sans bg-background text-foreground antialiased h-full">
        {children}
      </body>
    </html>
  );
}
