'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PageLoaderProps {
  message?: string;
}

// Curated collection of motivational quotes from legendary authors and thinkers
const MOTIVATIONAL_QUOTES = [
  // Oscar Wilde
  { quote: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { quote: "To live is the rarest thing in the world. Most people exist, that is all.", author: "Oscar Wilde" },
  { quote: "The only way to get rid of temptation is to yield to it.", author: "Oscar Wilde" },
  { quote: "Experience is simply the name we give our mistakes.", author: "Oscar Wilde" },
  { quote: "I have the simplest tastes. I am always satisfied with the best.", author: "Oscar Wilde" },

  // Mark Twain
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did.", author: "Mark Twain" },
  { quote: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" },
  { quote: "The two most important days in your life are the day you are born and the day you find out why.", author: "Mark Twain" },
  { quote: "Courage is resistance to fear, mastery of fear – not absence of fear.", author: "Mark Twain" },

  // Albert Einstein
  { quote: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { quote: "Life is like riding a bicycle. To keep your balance, you must keep moving.", author: "Albert Einstein" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "The only source of knowledge is experience.", author: "Albert Einstein" },
  { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },

  // Steve Jobs
  { quote: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "The people who are crazy enough to think they can change the world are the ones who do.", author: "Steve Jobs" },

  // Marcus Aurelius
  { quote: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius" },
  { quote: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { quote: "Very little is needed to make a happy life; it is all within yourself.", author: "Marcus Aurelius" },

  // Leonardo da Vinci
  { quote: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "It had long since come to my attention that people of accomplishment rarely sat back and let things happen to them.", author: "Leonardo da Vinci" },

  // Seneca
  { quote: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { quote: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { quote: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },

  // Maya Angelou
  { quote: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.", author: "Maya Angelou" },
  { quote: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou" },
  { quote: "We delight in the beauty of the butterfly, but rarely admit the changes it has gone through to achieve that beauty.", author: "Maya Angelou" },

  // Ralph Waldo Emerson
  { quote: "Do not go where the path may lead, go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { quote: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
  { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },

  // Naval Ravikant
  { quote: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.", author: "Naval Ravikant" },
  { quote: "Learn to sell. Learn to build. If you can do both, you will be unstoppable.", author: "Naval Ravikant" },
  { quote: "The most important skill for getting rich is becoming a perpetual learner.", author: "Naval Ravikant" },

  // Rumi
  { quote: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", author: "Rumi" },
  { quote: "What you seek is seeking you.", author: "Rumi" },
  { quote: "The wound is the place where the Light enters you.", author: "Rumi" },
];

function getRandomQuote() {
  return MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
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
  const [quote, setQuote] = useState(() => getRandomQuote());
  const [fadeIn, setFadeIn] = useState(true);

  // Change quote every 5 seconds with fade animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuote(getRandomQuote());
        setFadeIn(true);
      }, 500);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/90 to-slate-950" />

      {/* Animated mesh gradient overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent animate-pulse" />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/10 via-transparent to-transparent animate-pulse"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/30 rounded-full animate-loader-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 max-w-2xl mx-auto text-center">
        {/* Futuristic loader animation */}
        <div className="relative mb-12 w-24 h-24">
          {/* Outer rotating ring */}
          <div className="absolute inset-[-8px] w-[calc(100%+16px)] h-[calc(100%+16px)]">
            <div
              className="w-full h-full rounded-full border-2 border-purple-500/30 animate-spin"
              style={{ animationDuration: '3s' }}
            />
          </div>

          {/* Second rotating ring (reverse) */}
          <div className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)]">
            <div className="w-full h-full rounded-full border border-dashed border-cyan-400/20 animate-loader-orbit-reverse" />
          </div>

          {/* Middle pulsing ring */}
          <div className="absolute inset-0">
            <div
              className="w-full h-full rounded-full border border-cyan-400/40 animate-ping"
              style={{ animationDuration: '2s' }}
            />
          </div>

          {/* Inner glowing orb */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center shadow-2xl animate-loader-pulse-glow">
            {/* Shimmer effect overlay */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-loader-shimmer" />
            </div>

            {/* Icon */}
            <Sparkles className="w-8 h-8 text-white animate-pulse relative z-10" />
          </div>

          {/* Orbiting dots */}
          <div className="absolute inset-[-16px] w-[calc(100%+32px)] h-[calc(100%+32px)] animate-loader-orbit">
            <div className="absolute top-0 left-1/2 w-2 h-2 -ml-1 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
            <div className="absolute bottom-0 left-1/2 w-2 h-2 -ml-1 bg-pink-400 rounded-full shadow-lg shadow-pink-400/50" />
            <div className="absolute left-0 top-1/2 w-2 h-2 -mt-1 bg-purple-400 rounded-full shadow-lg shadow-purple-400/50" />
            <div className="absolute right-0 top-1/2 w-2 h-2 -mt-1 bg-yellow-400 rounded-full shadow-lg shadow-yellow-400/50" />
          </div>
        </div>

        {/* Quote section */}
        <div
          className={`transition-all duration-500 transform ${
            fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Quote text */}
          <blockquote className="text-xl md:text-2xl font-light text-white/90 leading-relaxed mb-4 italic">
            &ldquo;{quote.quote}&rdquo;
          </blockquote>

          {/* Author */}
          <p className="text-sm md:text-base font-medium text-purple-300/80">
            — {quote.author}
          </p>
        </div>

        {/* Loading indicator */}
        <div className="mt-12 flex flex-col items-center gap-4">
          {/* Shimmer progress bar */}
          <div className="relative w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full animate-loader-shimmer-bar" />
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-loader-shimmer" />
          </div>

          {/* Loading message */}
          <p className="text-sm text-white/60 font-medium tracking-wide animate-pulse">
            {message}
          </p>
        </div>
      </div>

      {/* Bottom decorative element */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/30">
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <Sparkles className="w-4 h-4" />
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
    </div>
  );
}

// Student-specific loader with quote - can be used across student pages
export function StudentPageLoader({ message = 'Preparing your learning experience...' }: PageLoaderProps) {
  return <FullPageLoader message={message} />;
}
