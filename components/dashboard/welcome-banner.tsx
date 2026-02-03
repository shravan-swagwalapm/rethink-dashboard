'use client';

import { useUser } from '@/hooks/use-user';
import { Card } from '@/components/ui/card';
import { Sparkles, Zap, TrendingUp, Target, Rocket } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useEffect, useState } from 'react';

interface WelcomeBannerProps {
  cohortStartDate?: Date | null;
  cohortName?: string;
}

export function WelcomeBanner({ cohortStartDate, cohortName }: WelcomeBannerProps) {
  const { profile } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const daysUntilStart = cohortStartDate ? differenceInDays(cohortStartDate, new Date()) : null;
  const hasStarted = daysUntilStart !== null && daysUntilStart <= 0;

  return (
    <div className="relative group">
      {/* Animated border glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-sm opacity-75 group-hover:opacity-100 transition duration-500 animate-border-glow" />

      <Card className="relative overflow-hidden border-0 shadow-2xl rounded-2xl">
        {/* Deep space gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900" />

        {/* Abstract wave background SVG */}
        <div className="absolute inset-0 opacity-40">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1200 400"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="wave-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="wave-gradient-3" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Aurora wave 1 */}
            <path
              d="M0,200 C150,100 350,300 600,200 C850,100 1050,250 1200,150 L1200,400 L0,400 Z"
              fill="url(#wave-gradient-1)"
              filter="url(#glow)"
              className="animate-wave-slow"
            />
            {/* Aurora wave 2 */}
            <path
              d="M0,250 C200,150 400,350 700,250 C900,180 1100,300 1200,220 L1200,400 L0,400 Z"
              fill="url(#wave-gradient-2)"
              filter="url(#glow)"
              className="animate-wave-medium"
            />
            {/* Aurora wave 3 */}
            <path
              d="M0,300 C250,220 450,380 750,280 C950,200 1150,320 1200,280 L1200,400 L0,400 Z"
              fill="url(#wave-gradient-3)"
              filter="url(#glow)"
              className="animate-wave-fast"
            />
            {/* Floating particles */}
            <circle cx="100" cy="80" r="3" fill="#06b6d4" opacity="0.6" className="animate-float-particle" />
            <circle cx="300" cy="120" r="2" fill="#8b5cf6" opacity="0.5" className="animate-float-particle-delayed" />
            <circle cx="500" cy="60" r="4" fill="#ec4899" opacity="0.4" className="animate-float-particle" />
            <circle cx="700" cy="140" r="2" fill="#06b6d4" opacity="0.6" className="animate-float-particle-delayed" />
            <circle cx="900" cy="90" r="3" fill="#8b5cf6" opacity="0.5" className="animate-float-particle" />
            <circle cx="1100" cy="110" r="2" fill="#ec4899" opacity="0.4" className="animate-float-particle-delayed" />
            {/* Glowing lines */}
            <line x1="0" y1="150" x2="400" y2="100" stroke="url(#wave-gradient-1)" strokeWidth="1" opacity="0.3" />
            <line x1="800" y1="80" x2="1200" y2="130" stroke="url(#wave-gradient-2)" strokeWidth="1" opacity="0.3" />
          </svg>
        </div>

        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-gradient-x" />

        {/* Cyber grid pattern */}
        <div className="absolute inset-0 opacity-15">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
          }} />
        </div>

        {/* Floating neon orbs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute top-20 right-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-float-delayed" />
          <div className="absolute bottom-5 left-1/4 w-36 h-36 bg-pink-500/20 rounded-full blur-3xl animate-float-slow" />
        </div>

        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-20 animate-scan-line" />
        </div>

        <div className="relative p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-start justify-between gap-6">
            {/* Left content */}
            <div className="space-y-5 flex-1">
              {/* Welcome badge with glow */}
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left duration-500">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400 rounded-xl blur-md opacity-50 animate-pulse" />
                  <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-cyan-500/30 shadow-lg shadow-cyan-500/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  <span className="text-cyan-300 text-sm font-semibold tracking-wider uppercase">
                    Welcome back
                  </span>
                </div>
              </div>

              {/* Main greeting with gradient text */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold animate-in fade-in slide-in-from-left duration-700 leading-tight">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent drop-shadow-lg">
                  {getGreeting()},
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  {firstName}!
                </span>
              </h1>

              {cohortName && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left duration-900">
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-md border border-purple-500/30 shadow-lg shadow-purple-500/10">
                    <Target className="w-4 h-4 text-purple-300" />
                    <span className="text-white font-semibold text-sm md:text-base">
                      {cohortName}
                    </span>
                  </div>
                </div>
              )}

              {cohortStartDate && (
                <div className="flex items-start gap-3 animate-in fade-in slide-in-from-left duration-1000">
                  <div className="flex-1 max-w-md p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
                    {hasStarted ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-yellow-500/20">
                            <Zap className="w-4 h-4 text-yellow-400" />
                          </div>
                          <span className="text-yellow-300 text-sm font-bold uppercase tracking-wide">Cohort in Progress</span>
                        </div>
                        <p className="text-white/80 text-sm pl-8">
                          Started {format(cohortStartDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-green-500/20">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                          </div>
                          <span className="text-green-300 text-sm font-bold uppercase tracking-wide">Starting Soon</span>
                        </div>
                        <p className="text-white/80 text-sm pl-8">
                          <span className="text-white font-semibold">{daysUntilStart}</span> {daysUntilStart === 1 ? 'day' : 'days'} until {format(cohortStartDate, 'MMM d')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!cohortStartDate && (
                <p className="text-white/70 text-base md:text-lg animate-in fade-in slide-in-from-left duration-1000 max-w-md">
                  Ready to continue your <span className="text-cyan-300 font-semibold">learning journey</span>?
                </p>
              )}
            </div>

            {/* Right side - Futuristic HUD display */}
            <div className="hidden lg:flex flex-col gap-4 animate-in fade-in slide-in-from-right duration-700">
              {/* Holographic stat cards */}
              <div className="flex gap-4">
                <div className="relative group/card">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur opacity-30 group-hover/card:opacity-60 transition duration-300" />
                  <div className="relative w-28 h-28 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-4 flex flex-col items-center justify-center animate-float">
                    <div className="text-3xl font-bold bg-gradient-to-b from-white to-cyan-200 bg-clip-text text-transparent">
                      {mounted ? new Date().getDate() : '--'}
                    </div>
                    <div className="text-xs text-cyan-400 uppercase tracking-widest font-semibold mt-1">
                      {mounted ? format(new Date(), 'MMM') : '---'}
                    </div>
                  </div>
                </div>
                <div className="relative group/card">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover/card:opacity-60 transition duration-300" />
                  <div className="relative w-28 h-28 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-purple-500/30 p-4 flex flex-col items-center justify-center animate-float-delayed">
                    <div className="text-3xl font-bold bg-gradient-to-b from-white to-purple-200 bg-clip-text text-transparent font-mono">
                      {mounted ? format(new Date(), 'HH:mm') : '--:--'}
                    </div>
                    <div className="text-xs text-purple-400 uppercase tracking-widest font-semibold mt-1">Local</div>
                  </div>
                </div>
              </div>

              {/* Motivational CTA card */}
              <div className="relative overflow-hidden">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-40" />
                <div className="relative w-60 h-20 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 flex items-center justify-center overflow-hidden">
                  {/* Animated shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
                  {/* Particle dots */}
                  <div className="absolute top-2 left-2 w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
                  <div className="absolute bottom-3 right-4 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
                  <div className="relative flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                    <span className="text-white font-bold text-lg tracking-wide">Keep Learning!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom neon line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-sm" />
      </Card>
    </div>
  );
}
