'use client';

import { useEffect, useState, useRef } from 'react';

interface UseAnimatedCounterOptions {
  /** Target number to count to */
  target: number;
  /** Duration in ms (default: 1000) */
  duration?: number;
  /** Delay before starting in ms (default: 0) */
  delay?: number;
  /** Whether the animation is enabled (use for viewport triggering) */
  enabled?: boolean;
}

/**
 * Animated counter hook with easeOutCubic easing.
 * Counts from 0 to target with smooth deceleration.
 *
 * Usage:
 *   const count = useAnimatedCounter({ target: 42, duration: 1500 });
 *   const count = useAnimatedCounter({ target: 100, enabled: isInView });
 */
export function useAnimatedCounter({
  target,
  duration = 1000,
  delay = 0,
  enabled = true,
}: UseAnimatedCounterOptions): number {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (!enabled) return;

    let startTime: number;
    let animationFrame: number;
    let timeoutId: ReturnType<typeof setTimeout>;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - (1 - progress)^3
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easedProgress * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    if (delay > 0) {
      timeoutId = setTimeout(() => {
        animationFrame = requestAnimationFrame(animate);
      }, delay);
    } else {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeoutId);
    };
  }, [target, duration, delay, enabled]);

  // Reset if target changes
  useEffect(() => {
    if (prevTarget.current !== target) {
      prevTarget.current = target;
    }
  }, [target]);

  return count;
}
