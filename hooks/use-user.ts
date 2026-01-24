'use client';

import { useEffect, useState, useRef } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getClient, resetClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingCompletedRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    const supabase = getClient();
    isMountedRef.current = true;
    loadingCompletedRef.current = false;

    const completeLoading = () => {
      if (!loadingCompletedRef.current && isMountedRef.current) {
        loadingCompletedRef.current = true;
        setLoading(false);
      }
    };

    // Safety timeout - ensure loading becomes false within 1500ms max
    const timeoutId = setTimeout(() => {
      if (!loadingCompletedRef.current) {
        console.warn('useUser: Auth check timed out after 1500ms, forcing loading to false');
        completeLoading();
      }
    }, 1500);

    // Get initial session via API (more reliable)
    const getUser = async () => {
      if (initialFetchDoneRef.current) return;
      initialFetchDoneRef.current = true;

      try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        const data = await response.json();

        if (!isMountedRef.current) return;

        setUser(data.user);
        setProfile(data.profile);
        currentUserIdRef.current = data.user?.id || null;
      } catch (error) {
        console.error('useUser: Error fetching user:', error);
      } finally {
        clearTimeout(timeoutId);
        completeLoading();
      }
    };

    getUser();

    // Listen for auth changes - only react to actual user changes, not visibility events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!isMountedRef.current) return;

        const newUserId = session?.user?.id || null;

        // Skip if user hasn't actually changed (prevents refresh on tab focus)
        if (newUserId === currentUserIdRef.current && loadingCompletedRef.current) {
          return;
        }

        if (session?.user) {
          // Only clear and show loading if user actually changed
          if (newUserId !== currentUserIdRef.current) {
            setUser(null);
            setProfile(null);
            setLoading(true);
            loadingCompletedRef.current = false;
            currentUserIdRef.current = newUserId;

            try {
              const response = await fetch('/api/me', { cache: 'no-store' });
              const data = await response.json();

              if (!isMountedRef.current) return;
              setUser(data.user);
              setProfile(data.profile);
            } catch (err) {
              console.error('useUser: Profile fetch error:', err);
              setUser(session.user);
              setProfile(null);
            }
          }
        } else {
          // User signed out
          currentUserIdRef.current = null;
          setUser(null);
          setProfile(null);
        }

        completeLoading();
      }
    );

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('useUser.signOut: Starting Supabase sign out...');
    // Clear state immediately
    setUser(null);
    setProfile(null);

    try {
      const supabase = getClient();
      // Use scope: 'global' to sign out from all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('useUser.signOut: Error signing out:', error);
      }
      console.log('useUser.signOut: Supabase sign out successful');
      // Reset the client singleton to clear any cached session
      resetClient();
    } catch (error) {
      console.error('useUser.signOut: Exception during sign out:', error);
      resetClient();
    }
  };

  const refreshProfile = async () => {
    if (!user) return;

    const supabase = getClient();
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!error) {
      setProfile(profileData);
    }
  };

  return {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === 'admin' || profile?.role === 'company_user',
    isMentor: profile?.role === 'mentor',
    isStudent: profile?.role === 'student',
  };
}
