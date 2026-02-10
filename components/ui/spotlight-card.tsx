'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  as?: 'div' | 'article';
}

export function SpotlightCard({
  children,
  className,
  glowColor = 'hsl(172 66% 45%)',
  as: Tag = 'div',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  }

  // Check for touch/hover capability — no-op on touch devices
  const supportsHover =
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover)').matches
      : true;

  return (
    <Tag
      ref={cardRef as React.Ref<HTMLDivElement>}
      onMouseMove={supportsHover ? handleMouseMove : undefined}
      onMouseEnter={supportsHover ? () => setIsHovering(true) : undefined}
      onMouseLeave={supportsHover ? () => setIsHovering(false) : undefined}
      className={cn('spotlight-card relative overflow-hidden', className)}
      style={
        {
          '--glow-color': glowColor,
        } as React.CSSProperties
      }
    >
      {/* Border glow layer */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), ${glowColor.replace(')', ' / 0.12)')}, transparent 60%)`,
        }}
      />
      {/* Inner spotlight layer */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(250px circle at var(--mouse-x) var(--mouse-y), ${glowColor.replace(')', ' / 0.05)')}, transparent 50%)`,
        }}
      />
      {children}
    </Tag>
  );
}
