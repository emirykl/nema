"use client";

import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { NemaSquid } from "@/components/illustrations/NemaSquid";
import { TornEdge } from "@/components/zine/Torn";

/** Set after the first page mounts, so the very first load skips the curtain. */
let hasNavigated = false;

const EASE_CURTAIN = [0.76, 0, 0.24, 1] as const;
const EASE_RISE = [0.2, 0.8, 0.2, 1] as const;

/**
 * Route change effect: a torn navy paper curtain with the squid lifts off
 * the screen while the new page rises in. Nav and footer stay put.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // Read once per mount: the template remounts on every navigation.
  const [navigating] = useState(() => hasNavigated);
  useEffect(() => {
    hasNavigated = true;
  }, []);
  const curtain = navigating && !reduced;

  return (
    <MotionConfig reducedMotion="user">
      {curtain && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60]"
          initial={{ y: "0%" }}
          animate={{ y: "-110%" }}
          transition={{ duration: 0.65, ease: EASE_CURTAIN, delay: 0.12 }}
        >
          <div className="grain-dark grid h-dvh place-items-center bg-tape">
            <motion.div
              initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE_RISE }}
            >
              <NemaSquid className="h-28 w-24" title="" />
            </motion.div>
          </div>
          <TornEdge to="var(--tape)" seed={31} flip />
        </motion.div>
      )}
      <motion.div
        initial={navigating ? { opacity: 0, y: 24 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_RISE, delay: curtain ? 0.3 : 0 }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
