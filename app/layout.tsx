import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import MotionProvider from "@/components/motion-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Display landing page (slogan/H1 + label brand).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-montserrat-google",
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
    <html
      lang="id"
      className={cn(
        "h-full dark",
        inter.variable,
        jetbrainsMono.variable,
        montserrat.variable,
      )}
    >
      <body className="font-sans bg-background text-foreground antialiased h-full">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
