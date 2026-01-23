'use client';

import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />

        {/* Inner gradient circle */}
        <div className="relative w-16 h-16 rounded-full gradient-bg flex items-center justify-center shadow-lg">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      </div>

      {/* Loading text */}
      <p className="mt-6 text-sm font-medium text-muted-foreground animate-pulse">
        {message}
      </p>
    </div>
  );
}

export function FullPageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="relative">
        {/* Outer glow ring */}
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />

        {/* Inner gradient circle */}
        <div className="relative w-20 h-20 rounded-full gradient-bg flex items-center justify-center shadow-xl">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      </div>

      {/* Loading text */}
      <p className="mt-8 text-base font-medium text-foreground">
        {message}
      </p>

      {/* Subtle progress bar */}
      <div className="mt-4 w-48 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full w-1/2 gradient-bg rounded-full animate-[shimmer_1.5s_infinite]" />
      </div>
    </div>
  );
}
