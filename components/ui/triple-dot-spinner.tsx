import { cn } from "@/lib/utils";
type Props = { className?: string; size?: number };
export function TripleDotSpinner({ className, size = 16 }: Props) {
  const dot = 3.5;
  const radius = Math.max(4, size / 2 - 2);
  const opacities = [1, 0.42, 0.2];
  return (
    <div className={cn("relative shrink-0 animate-spin", className)} style={{ width: size, height: size, animationDuration: "1.15s" }} aria-label="Loading" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute left-1/2 top-1/2 rounded-full bg-zinc-400" style={{ width: dot, height: dot, marginLeft: -dot / 2, marginTop: -radius - dot / 2, opacity: opacities[i], transform: `rotate(${i * 120}deg)`, transformOrigin: `${dot / 2}px ${radius + dot / 2}px` }} />
      ))}
    </div>
  );
}
export default TripleDotSpinner;
