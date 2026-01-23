'use client';

import { useState, useCallback } from 'react';
import { DashboardSidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { useUser } from '@/hooks/use-user';
import { FullPageLoader } from '@/components/ui/page-loader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, profile } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Show full-page loader while user data is loading
  if (loading) {
    return <FullPageLoader message="Loading your dashboard..." />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={handleMobileMenuClose}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader onMenuClick={handleMobileMenuToggle} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
