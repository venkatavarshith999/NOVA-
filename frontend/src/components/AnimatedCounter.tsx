import { useEffect, useRef, useState } from "react";

export default function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) return;

    start.current = null;
    let raf: number;

    function animate(ts: number) {
      if (!start.current) start.current = ts;
      const elapsed = ts - start.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        ref.current = to;
      }
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}
