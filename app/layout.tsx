import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ITZ AI — Personal AI Assistant",
  description: "Personal AI Agent customized with owner knowledge, personality, and context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${montserrat.variable} h-full`}>
      <body className="font-sans bg-zinc-950 text-zinc-100 antialiased h-full selection:bg-zinc-800 selection:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
