import MotionProvider from "@/components/motion-provider";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}