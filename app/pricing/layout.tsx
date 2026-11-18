import MotionProvider from "@/components/motion-provider";

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <MotionProvider>{children}</MotionProvider>;
}