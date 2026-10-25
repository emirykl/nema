"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Counts from `from` (default zero) to `value` the first time it scrolls into view. Writes the
 * text directly, so the count costs no React re-renders.
 */
export function CountUp({
  value,
  format,
  from = 0,
  duration = 1.6,
}: {
  value: number;
  format: (n: number) => string;
  from?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  // Keep the latest formatter without restarting the count on every render.
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduced) {
      el.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => {
        el.textContent = formatRef.current(n);
      },
    });
    return () => controls.stop();
  }, [inView, from, value, duration, reduced]);

  return (
    <span ref={ref} className="tabular">
      {format(from)}
    </span>
  );
}
