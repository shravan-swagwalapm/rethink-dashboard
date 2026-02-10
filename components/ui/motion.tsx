'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import React from 'react';

// ============================================================================
// Shared Animation Variants
// ============================================================================

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1], // Spring easing
    },
  },
};

const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// ============================================================================
// MotionContainer — Orchestrates stagger for children
// ============================================================================

interface MotionContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'ul';
}

export function MotionContainer({
  children,
  className,
  delay = 0.1,
  as = 'div',
}: MotionContainerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const Component = motion[as];

  return (
    <Component
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.06,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-40px' }}
      className={className}
    >
      {children}
    </Component>
  );
}

// ============================================================================
// MotionItem — Individual animated child within a MotionContainer
// ============================================================================

interface MotionItemProps {
  children: React.ReactNode;
  className?: string;
}

export function MotionItem({ children, className }: MotionItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ============================================================================
// MotionFadeIn — Single element fade, no stagger needed
// ============================================================================

interface MotionFadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function MotionFadeIn({
  children,
  className,
  delay = 0,
}: MotionFadeInProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
