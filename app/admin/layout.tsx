import MotionProvider from "@/components/motion-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}