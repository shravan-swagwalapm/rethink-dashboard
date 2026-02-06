'use client';

import { createContext, useContext } from 'react';
import { useUser } from '@/hooks/use-user';

/**
 * UserContext provides shared auth state across the component tree.
 *
 * Without this context, every component calling useUser() independently
 * triggers its own /api/me fetch. With UserProvider at the layout level,
 * a single fetch is shared by all consumers (sidebar, header, pages, etc.)
 *
 * Usage:
 *   // In layout:
 *   <UserProvider>{children}</UserProvider>
 *
 *   // In components:
 *   const { profile, isAdmin, loading } = useUserContext();
 */

type UserContextValue = ReturnType<typeof useUser>;

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const userState = useUser();

  return (
    <UserContext.Provider value={userState}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error(
      'useUserContext must be used within a UserProvider. ' +
      'Wrap your layout with <UserProvider> or use useUser() directly for standalone usage.'
    );
  }
  return context;
}
