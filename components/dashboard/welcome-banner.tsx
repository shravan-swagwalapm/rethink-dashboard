'use client';

import { useUserContext } from '@/contexts/user-context';
import { Zap, TrendingUp, ArrowRight, Play, Calendar } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import type { Session, ModuleResource } from '@/types';

interface WelcomeBannerProps {
  cohortStartDate?: Date | null;
  cohortName?: string;
  nextSession?: Session | null;
  lastLearning?: (ModuleResource & { progress?: { is_completed: boolean } }) | null;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setColonVisible(v => !v);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = (hours % 12 || 12).toString();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-baseline gap-0.5">
        <span className="text-5xl md:text-6xl font-bold text-white/90 tabular-nums font-heading tracking-tight leading-none">
          {displayHours}
        </span>
        <span className="text-5xl md:text-6xl font-bold tabular-nums font-heading tracking-tight leading-none"
          style={{ color: colonVisible ? 'hsl(172 60% 55%)' : 'transparent', transition: 'color 0.15s' }}>
          :
        </span>
        <span className="text-5xl md:text-6xl font-bold text-white/90 tabular-nums font-heading tracking-tight leading-none">
          {minutes}
        </span>
        <span className="text-lg font-semibold text-white/40 ml-1.5 self-end mb-1 font-heading">
          {period}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-white/35 font-heading tracking-wide uppercase">
          {format(new Date(), 'EEEE')}
        </span>
        <span className="w-px h-3 bg-white/15" />
        <span className="text-xs font-semibold text-white/50 font-heading tracking-wide">
          {format(new Date(), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  );
}

/** Deterministic pseudo-random from seed */
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/** Generate star positions once (stable across re-renders) */
function useStarField() {
  return useMemo(() => {
    const layers: Array<{
      stars: Array<{ x: number; y: number; size: number; opacity: number; delay: number }>;
      speed: number;
      direction: 'left' | 'right';
    }> = [
      // Layer 1 — distant tiny stars, slow drift right
      {
        speed: 120,
        direction: 'right',
        stars: Array.from({ length: 45 }, (_, i) => ({
          x: seededRandom(i * 7 + 1) * 100,
          y: seededRandom(i * 7 + 2) * 100,
          size: 1 + seededRandom(i * 7 + 3) * 0.5,
          opacity: 0.15 + seededRandom(i * 7 + 4) * 0.25,
          delay: seededRandom(i * 7 + 5) * 8,
        })),
      },
      // Layer 2 — mid-distance stars, moderate drift left
      {
        speed: 80,
        direction: 'left',
        stars: Array.from({ length: 25 }, (_, i) => ({
          x: seededRandom(i * 11 + 100) * 100,
          y: seededRandom(i * 11 + 101) * 100,
          size: 1.5 + seededRandom(i * 11 + 102) * 1,
          opacity: 0.2 + seededRandom(i * 11 + 103) * 0.3,
          delay: seededRandom(i * 11 + 104) * 6,
        })),
      },
      // Layer 3 — close bright stars, faster drift right
      {
        speed: 50,
        direction: 'right',
        stars: Array.from({ length: 8 }, (_, i) => ({
          x: seededRandom(i * 13 + 200) * 100,
          y: seededRandom(i * 13 + 201) * 100,
          size: 2 + seededRandom(i * 13 + 202) * 1.5,
          opacity: 0.4 + seededRandom(i * 13 + 203) * 0.35,
          delay: seededRandom(i * 13 + 204) * 4,
        })),
      },
    ];
    return layers;
  }, []);
}

// Orbital ring configuration
const orbits = [
  { rx: 180, ry: 60, cx: '72%', cy: '55%', speed: 25, dotSize: 3, color: 'hsl(172 60% 55%)', tilt: -15 },
  { rx: 120, ry: 40, cx: '65%', cy: '45%', speed: 18, dotSize: 2.5, color: 'hsl(210 70% 60%)', tilt: 10 },
  { rx: 70, ry: 25, cx: '68%', cy: '50%', speed: 12, dotSize: 2, color: 'hsl(172 50% 65%)', tilt: -5 },
];

export function WelcomeBanner({ cohortStartDate, cohortName, nextSession, lastLearning }: WelcomeBannerProps) {
  const { profile } = useUserContext();
  const starLayers = useStarField();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const daysUntilStart = cohortStartDate ? differenceInDays(cohortStartDate, new Date()) : null;
  const hasStarted = daysUntilStart !== null && daysUntilStart <= 0;

  const getQuickAction = () => {
    if (nextSession) {
      const sessionDate = parseISO(nextSession.scheduled_at);
      const isSessionToday = differenceInDays(sessionDate, new Date()) === 0;
      return {
        label: isSessionToday ? 'Session today' : 'Next session',
        value: nextSession.title,
        time: format(sessionDate, 'EEE, MMM d · h:mm a'),
        href: '/calendar',
        icon: Calendar,
      };
    }
    if (lastLearning && !lastLearning.progress?.is_completed) {
      return { label: 'Continue learning', value: lastLearning.title, href: `/learnings?resource=${lastLearning.id}`, icon: Play };
    }
    return null;
  };

  const quickAction = getQuickAction();

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.15] card-3d-static">
      {/* ===== Cosmic Background ===== */}
      <div className="absolute inset-0">
        {/* Deep space gradient */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 30% 50%, hsl(225 35% 10%) 0%, hsl(230 40% 5%) 50%, hsl(235 45% 3%) 100%)',
        }} />

        {/* Nebula glow — soft color clouds */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[600px] h-[400px] -top-[100px] right-[5%] rounded-full opacity-[0.06]"
            style={{
              background: 'radial-gradient(ellipse, hsl(172 70% 45%), transparent 70%)',
              animation: 'nebula-drift 20s ease-in-out infinite',
            }} />
          <div className="absolute w-[500px] h-[350px] bottom-[-100px] left-[10%] rounded-full opacity-[0.04]"
            style={{
              background: 'radial-gradient(ellipse, hsl(210 80% 50%), transparent 70%)',
              animation: 'nebula-drift 25s ease-in-out infinite reverse',
            }} />
          <div className="absolute w-[300px] h-[200px] top-[30%] left-[40%] rounded-full opacity-[0.03]"
            style={{
              background: 'radial-gradient(ellipse, hsl(260 60% 50%), transparent 70%)',
              animation: 'nebula-drift 30s ease-in-out infinite 5s',
            }} />
        </div>

        {/* Star field — 3 parallax layers */}
        {starLayers.map((layer, li) => (
          <div key={li} className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{
              animation: `star-drift-${layer.direction} ${layer.speed}s linear infinite`,
            }}>
            {/* Duplicate for seamless loop */}
            {[0, 1].map(copy => (
              <div key={copy} className="absolute inset-0" style={{
                transform: copy === 1
                  ? `translateX(${layer.direction === 'right' ? '-100%' : '100%'})`
                  : undefined,
              }}>
                {layer.stars.map((star, si) => (
                  <div key={si} className="absolute rounded-full"
                    style={{
                      width: star.size,
                      height: star.size,
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      background: li === 2 ? 'hsl(172 50% 80%)' : 'hsl(220 20% 90%)',
                      opacity: star.opacity,
                      animation: `star-twinkle ${3 + star.delay}s ease-in-out infinite ${star.delay}s`,
                    }} />
                ))}
              </div>
            ))}
          </div>
        ))}

        {/* Bright accent stars — with glow */}
        {[
          { x: 25, y: 20, size: 3, glow: 8 },
          { x: 55, y: 70, size: 2.5, glow: 6 },
          { x: 80, y: 30, size: 2, glow: 5 },
          { x: 45, y: 15, size: 2, glow: 5 },
        ].map((star, i) => (
          <div key={`bright-${i}`} className="absolute rounded-full pointer-events-none"
            style={{
              width: star.size,
              height: star.size,
              left: `${star.x}%`,
              top: `${star.y}%`,
              background: 'hsl(172 60% 75%)',
              boxShadow: `0 0 ${star.glow}px ${star.glow / 2}px hsl(172 60% 55% / 0.4)`,
              animation: `star-twinkle ${4 + i * 1.5}s ease-in-out infinite ${i * 1.2}s`,
            }} />
        ))}

        {/* Orbital rings with moving dots */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {orbits.map((orbit, i) => {
            const cxVal = parseFloat(orbit.cx) * 12; // convert % to viewBox units
            const cyVal = parseFloat(orbit.cy) * 3;
            return (
              <g key={i} transform={`rotate(${orbit.tilt} ${cxVal} ${cyVal})`}>
                {/* Orbit path — very subtle */}
                <ellipse cx={cxVal} cy={cyVal} rx={orbit.rx} ry={orbit.ry}
                  fill="none" stroke="hsl(172 40% 50%)" strokeWidth="0.4" opacity="0.08"
                  strokeDasharray="4 6" />
                {/* Orbiting dot */}
                <circle r={orbit.dotSize} fill={orbit.color} opacity="0.7">
                  <animateMotion
                    dur={`${orbit.speed}s`}
                    repeatCount="indefinite"
                    path={`M${cxVal - orbit.rx},${cyVal} a${orbit.rx},${orbit.ry} 0 1,1 ${orbit.rx * 2},0 a${orbit.rx},${orbit.ry} 0 1,1 -${orbit.rx * 2},0`}
                  />
                </circle>
                {/* Second orbiting dot (opposite side, dimmer) */}
                <circle r={orbit.dotSize * 0.6} fill={orbit.color} opacity="0.35">
                  <animateMotion
                    dur={`${orbit.speed}s`}
                    repeatCount="indefinite"
                    begin={`-${orbit.speed / 2}s`}
                    path={`M${cxVal - orbit.rx},${cyVal} a${orbit.rx},${orbit.ry} 0 1,1 ${orbit.rx * 2},0 a${orbit.rx},${orbit.ry} 0 1,1 -${orbit.rx * 2},0`}
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* Shooting star — occasional streak */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute" style={{
            width: '80px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, hsl(172 50% 80% / 0.7), transparent)',
            top: '18%',
            left: '-80px',
            animation: 'shooting-star 8s ease-in infinite 3s',
          }} />
          <div className="absolute" style={{
            width: '60px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, hsl(220 60% 80% / 0.5), transparent)',
            top: '65%',
            left: '-60px',
            animation: 'shooting-star 12s ease-in infinite 7s',
          }} />
        </div>

        <div className="absolute inset-0 surface-grain" />
      </div>

      {/* ===== Content ===== */}
      <div className="relative px-8 py-9 md:px-10 md:py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          {/* Left — greeting + name + meta */}
          <div className="space-y-2 flex-1">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase" style={{ color: 'hsl(172 60% 58%)' }}>
              {getGreeting()}
            </p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] font-heading tracking-tight">
              {firstName}
            </h1>
            <div className="flex items-center gap-3 pt-1.5">
              {cohortName && <span className="text-base text-white/60 font-medium">{cohortName}</span>}
              {cohortStartDate && (
                <>
                  <span className="w-px h-4 bg-white/20" />
                  {hasStarted ? (
                    <span className="inline-flex items-center gap-1.5 text-base text-amber-400 font-medium">
                      <Zap className="w-4 h-4" /> In progress since {format(cohortStartDate, 'MMM d')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-base text-emerald-400 font-medium">
                      <TrendingUp className="w-4 h-4" /> Starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'}
                    </span>
                  )}
                </>
              )}
            </div>

            {quickAction && (
              <Link href={quickAction.href}
                className="inline-flex items-center gap-2.5 mt-3 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.15] transition-all group">
                <quickAction.icon className="w-4 h-4" style={{ color: 'hsl(172 60% 58%)' }} />
                <span className="text-sm font-medium text-white/50">{quickAction.label}:</span>
                <span className="text-sm font-medium text-white/90 max-w-[250px] truncate">{quickAction.value}</span>
                <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}
          </div>

          {/* Right — live clock + date */}
          <div className="hidden md:block">
            <LiveClock />
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent 5%, hsl(172 55% 50% / 0.5) 50%, transparent 95%)',
      }} />
    </div>
  );
}
