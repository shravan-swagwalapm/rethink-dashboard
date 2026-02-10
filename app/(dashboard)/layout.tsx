'use client';

import { useState, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { UserProvider } from '@/contexts/user-context';
import { PageTransition } from '@/components/ui/page-transition';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Layout does NOT show any loader - each page handles its own loading state
  // This prevents double loading and ensures the full-page loader stays until data is ready
  return (
    <UserProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader onMenuClick={handleMobileMenuToggle} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto dot-pattern">
            <PageTransition className="max-w-7xl mx-auto">
              {children}
            </PageTransition>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
