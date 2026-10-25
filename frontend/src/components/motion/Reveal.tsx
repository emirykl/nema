"use client";

import { motion, type Variants } from "motion/react";
import { Children, type ReactNode } from "react";

const EASE = [0.2, 0.8, 0.2, 1] as const;
/** Plays once, when a fifth of the block is on screen. */
const VIEWPORT = { once: true, amount: 0.2 } as const;

const item: Variants = {
  hidden: { opacity: 0, y: 48 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

/** Rises into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={item}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** A grid or list whose children rise in one after another. Each child becomes the grid item. */
export function Stagger({ children, className, step = 0.1 }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
      variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}
    >
      {Children.toArray(children).map((child, i) => (
        <motion.div key={i} variants={item} className="min-w-0">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
