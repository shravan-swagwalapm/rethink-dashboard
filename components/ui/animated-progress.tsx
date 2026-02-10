'use client';

import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// AnimatedProgressBar — Horizontal bar that fills on viewport entry
// ============================================================================

interface AnimatedProgressBarProps {
  value: number; // 0-100
  className?: string;
  barClassName?: string;
  height?: string;
}

export function AnimatedProgressBar({
  value,
  className,
  barClassName,
  height = 'h-2',
}: AnimatedProgressBarProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();

  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      ref={ref}
      className={cn('w-full rounded-full bg-muted overflow-hidden', height, className)}
    >
      <motion.div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        initial={{ width: 0 }}
        animate={isInView ? { width: `${clampedValue}%` } : { width: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.2,
              }
        }
      />
    </div>
  );
}

// ============================================================================
// AnimatedProgressRing — SVG circle with animated stroke-dashoffset
// ============================================================================

interface AnimatedProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
  children?: React.ReactNode;
}

export function AnimatedProgressRing({
  value,
  size = 48,
  strokeWidth = 3,
  className,
  trackClassName,
  progressClassName,
  children,
}: AnimatedProgressRingProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldReduceMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(0, value));
  const targetOffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div ref={ref} className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className={cn('text-muted', trackClassName)}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className={cn('text-primary', progressClassName)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={
            isInView
              ? { strokeDashoffset: targetOffset }
              : { strokeDashoffset: circumference }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: 1,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.3,
                }
          }
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
