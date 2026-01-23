'use client';

import { useEffect, useState } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

// Demo user profile for testing without Supabase
const DEMO_PROFILE: Profile = {
  id: 'demo-user-id',
  email: 'demo@rethink.systems',
  full_name: 'Demo User',
  phone: '+91 9876543210',
  linkedin_url: 'https://linkedin.com/in/demo',
  portfolio_url: 'https://demo.rethink.systems',
  timezone: 'Asia/Kolkata',
  role: 'student',
  cohort_id: 'demo-cohort-id',
  mentor_id: null,
  avatar_url: null,
  calendly_url: null,
  calendly_shared: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const supabase = getClient();

    // Check for demo user first
    const demoUser = typeof window !== 'undefined' ? localStorage.getItem('demo_user') : null;
    if (demoUser) {
      setProfile(DEMO_PROFILE);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Get initial session
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          setProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(profile);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear demo user if present
    if (typeof window !== 'undefined') {
      localStorage.removeItem('demo_user');
    }
    setIsDemo(false);

    const supabase = getClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) return;

    const supabase = getClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(profile);
  };

  return {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    isDemo,
    isAdmin: profile?.role === 'admin' || profile?.role === 'company_user',
    isMentor: profile?.role === 'mentor',
    isStudent: profile?.role === 'student',
  };
}
