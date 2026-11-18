import MotionProvider from "@/components/motion-provider";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}