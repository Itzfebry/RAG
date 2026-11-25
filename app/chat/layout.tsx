import type { Metadata } from "next";
import MotionProvider from "@/components/motion-provider";

export const metadata: Metadata = {
  title: { absolute: "Discovery — ITZ AI" },
  description:
    "Ceritakan masalah bisnis Anda dan lihat langsung bagaimana sistem RAG ITZ memilih sumber, menyusun jawaban, dan merekomendasikan integrasi AI yang masuk akal.",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}
