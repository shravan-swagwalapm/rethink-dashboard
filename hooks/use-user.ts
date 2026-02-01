'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getClient, resetClient } from '@/lib/supabase/client';
import type { Profile, UserRoleAssignment } from '@/types';

// Helper to read cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  return null;
}

export function useUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoleAssignment, setActiveRoleAssignment] = useState<UserRoleAssignment | null>(null);
  const loadingCompletedRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const initialFetchDoneRef = useRef(false);
  const retryCountRef = useRef(0);

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
        // Retry once on failure
        if (retryCountRef.current === 0 && isMountedRef.current) {
          retryCountRef.current = 1;
          try {
            const response = await fetch('/api/me', { cache: 'no-store' });
            const data = await response.json();
            if (isMountedRef.current) {
              setUser(data.user);
              setProfile(data.profile);
              currentUserIdRef.current = data.user?.id || null;
            }
          } catch {
            // Silently fail - user will remain null
          }
        }
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
            } catch {
              // Fallback to session user without full profile
              if (isMountedRef.current) {
                setUser(session.user);
                setProfile(null);
              }
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

  // Load saved role from localStorage when profile changes
  useEffect(() => {
    if (profile?.role_assignments?.length) {
      // Check intended_role cookie FIRST (explicit login choice)
      const intendedRole = getCookie('intended_role'); // student or admin

      if (intendedRole) {
        // User just logged in with explicit role choice - prioritize over localStorage
        let defaultAssignment;
        if (intendedRole === 'admin') {
          // Find admin or company_user role
          defaultAssignment = profile.role_assignments.find(
            ra => ra.role === 'admin' || ra.role === 'company_user'
          );
        } else {
          // Default to student role for regular login
          defaultAssignment = profile.role_assignments.find(
            ra => ra.role === 'student'
          );
        }

        // Fallback to first assignment if intended role not found
        setActiveRoleAssignment(defaultAssignment || profile.role_assignments[0]);

        // Update localStorage with new role
        if (defaultAssignment) {
          localStorage.setItem('active_role_assignment_id', defaultAssignment.id);
        }

        // Clear the cookie after using it
        document.cookie = 'intended_role=; max-age=0';
      } else {
        // No intended role cookie - check localStorage for saved preference
        const savedId = localStorage.getItem('active_role_assignment_id');
        const savedAssignment = profile.role_assignments.find(ra => ra.id === savedId);

        if (savedAssignment) {
          // Use saved role from previous session
          setActiveRoleAssignment(savedAssignment);
        } else {
          // No saved role - default to first assignment
          setActiveRoleAssignment(profile.role_assignments[0]);
        }
      }
    } else {
      // No role assignments, clear active role
      setActiveRoleAssignment(null);
    }
  }, [profile?.role_assignments]);

  const signOut = async () => {
    // Clear state immediately
    setUser(null);
    setProfile(null);

    try {
      const supabase = getClient();
      // Use scope: 'global' to sign out from all sessions
      await supabase.auth.signOut({ scope: 'global' });
      // Reset the client singleton to clear any cached session
      resetClient();
    } catch {
      // Always reset client even on error to ensure clean state
      resetClient();
    }
  };

  const refreshProfile = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const supabase = getClient();
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        return false;
      }

      setProfile(profileData);
      return true;
    } catch {
      return false;
    }
  };

  const switchRole = (roleAssignmentId: string) => {
    const assignment = profile?.role_assignments?.find(ra => ra.id === roleAssignmentId);
    if (assignment) {
      setActiveRoleAssignment(assignment);
      localStorage.setItem('active_role_assignment_id', roleAssignmentId);

      // Refresh current page to show new role's view
      // Force full reload to ensure all components sync
      window.location.reload();
    }
  };

  // Compute active values
  const activeRole = activeRoleAssignment?.role ||
    (profile?.role_assignments?.length ? null : profile?.role) ||
    null;
  const activeCohortId = activeRoleAssignment?.cohort_id || profile?.cohort_id || null;
  const hasMultipleRoles = (profile?.role_assignments?.length || 0) > 1;

  return {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
    // Role checks based on active role
    isAdmin: activeRole === 'admin' || activeRole === 'company_user',
    isMentor: activeRole === 'mentor',
    isStudent: activeRole === 'student',
    // Multi-role properties
    activeRoleAssignment,
    activeRole,
    activeCohortId,
    hasMultipleRoles,
    switchRole,
    availableRoles: profile?.role_assignments || [],
  };
}
