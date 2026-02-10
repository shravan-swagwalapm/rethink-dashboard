'use client';

import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import React, { useRef } from 'react';

interface MagneticWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** How far the element shifts toward cursor (default 0.3 = 30% of distance) */
  strength?: number;
}

/**
 * Wraps a CTA button to create a magnetic pull toward the cursor.
 * The element shifts toward the mouse with spring physics and snaps back on leave.
 * No-op on touch devices.
 *
 * Usage:
 *   <MagneticWrapper>
 *     <Button>Start Learning</Button>
 *   </MagneticWrapper>
 */
export function MagneticWrapper({
  children,
  className,
  strength = 0.3,
}: MagneticWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  // Check for hover capability
  const supportsHover =
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover)').matches
      : false;

  if (shouldReduceMotion || !supportsHover) {
    return <div className={className}>{children}</div>;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    x.set(deltaX);
    y.set(deltaY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
