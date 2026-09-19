"use client";

import { motion, useReducedMotion } from "motion/react";

const PATH_COUNT = 14;

/**
 * Decorative curves for the auth brand panel (from the efferd auth-5 block).
 * The original drew 36 animated paths per layer, which is heavy enough to make
 * the sign-in screen tear and stutter while it repaints. This draws 14, moves
 * them slowly, and stands still for anyone who asked their system for reduced
 * motion.
 */
export function FloatingPaths({ position }: { position: number }) {
  const reduceMotion = useReducedMotion();
  const step = 2.5; // spread the fewer paths over the same area
  const paths = Array.from({ length: PATH_COUNT }, (_, i) => {
    const s = i * step;
    return {
      id: i,
      d: `M-${380 - s * 5 * position} -${189 + s * 6}C-${380 - s * 5 * position} -${189 + s * 6} -${312 - s * 5 * position} ${216 - s * 6} ${152 - s * 5 * position} ${343 - s * 6}C${616 - s * 5 * position} ${470 - s * 6} ${684 - s * 5 * position} ${875 - s * 6} ${684 - s * 5 * position} ${875 - s * 6}`,
      width: 0.5 + s * 0.03,
      opacity: 0.1 + s * 0.03,
      duration: 32 + (i % 7) * 4,
    };
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 [contain:paint]">
      <svg className="h-full w-full" fill="none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 696 316">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeOpacity={path.opacity}
            strokeWidth={path.width}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={reduceMotion ? { pathLength: 1, opacity: 0.5 } : { pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
            transition={reduceMotion ? { duration: 0 } : { duration: path.duration, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
        ))}
      </svg>
    </div>
  );
}
