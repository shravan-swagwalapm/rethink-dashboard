import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Mail, Phone, Globe, Linkedin, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Metadata } from 'next';

interface PublicProfilePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: card } = await supabase
    .from('profile_cards')
    .select('user_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!card) {
    return {
      title: 'Profile Not Found | Rethink Systems',
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', card.user_id)
    .single();

  return {
    title: `${profile?.full_name || 'Profile'} | Rethink Systems`,
    description: `View ${profile?.full_name || 'this user'}'s professional profile on Rethink Systems.`,
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch profile card (public access, no auth required)
  const { data: card, error: cardError } = await supabase
    .from('profile_cards')
    .select('user_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (cardError || !card) {
    notFound();
  }

  // Fetch user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', card.user_id)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  // Fire-and-forget: Increment view count
  // Using absolute URL for server-side fetch
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/profile/view/${slug}`, {
    method: 'POST',
  }).catch(() => {
    // Silently ignore errors - view tracking is non-critical
  });

  // Helper to get initials
  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Helper to format role display
  const getRoleDisplay = (role: string): string => {
    const roleMap: Record<string, string> = {
      student: 'Student',
      mentor: 'Mentor',
      admin: 'Admin',
      company_user: 'Company User',
      master: 'Master',
    };
    return roleMap[role] || 'User';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/20">
      {/* Animated background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Card */}
          <Card className="border-0 shadow-2xl overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
            {/* Header Gradient */}
            <div className="h-36 sm:h-40 bg-gradient-to-r from-purple-500 via-purple-550 to-purple-600 relative overflow-hidden">
              {/* Decorative pattern overlay */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
              {/* Gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-purple-600/20" />
            </div>

            <CardContent className="relative pt-0 pb-8 px-6 sm:px-8">
              {/* Avatar - elevated and centered */}
              <div className="relative -mt-20 sm:-mt-24 mb-6 flex justify-center">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-white dark:bg-gray-800 p-1.5 sm:p-2 shadow-2xl ring-4 ring-white dark:ring-gray-800">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || 'Profile'}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-gray-700 flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-purple-600 dark:text-purple-400 select-none">
                          {getInitials(profile.full_name)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Name and Role */}
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">
                  {profile.full_name || 'No Name Provided'}
                </h1>
                <Badge
                  variant="secondary"
                  className="text-sm px-4 py-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-0 font-medium"
                >
                  {getRoleDisplay(profile.role)}
                </Badge>
              </div>

              {/* Contact Information Cards */}
              <div className="space-y-3">
                {/* Email */}
                {profile.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50
                               hover:bg-purple-50 dark:hover:bg-purple-900/20
                               border border-transparent hover:border-purple-200 dark:hover:border-purple-800
                               transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600
                                    flex items-center justify-center shadow-lg shadow-purple-500/20
                                    group-hover:scale-110 group-hover:shadow-purple-500/30
                                    transition-all duration-200">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        Email
                      </p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 truncate
                                    group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {profile.email}
                      </p>
                    </div>
                  </a>
                )}

                {/* Phone */}
                {profile.phone && (
                  <a
                    href={`tel:${profile.phone}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50
                               hover:bg-purple-50 dark:hover:bg-purple-900/20
                               border border-transparent hover:border-purple-200 dark:hover:border-purple-800
                               transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600
                                    flex items-center justify-center shadow-lg shadow-purple-500/20
                                    group-hover:scale-110 group-hover:shadow-purple-500/30
                                    transition-all duration-200">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        Phone
                      </p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100
                                    group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {profile.phone}
                      </p>
                    </div>
                  </a>
                )}

                {/* Timezone */}
                {profile.timezone && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50
                                  border border-transparent">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600
                                    flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        Timezone
                      </p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                        {profile.timezone}
                      </p>
                    </div>
                  </div>
                )}

                {/* LinkedIn */}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50
                               hover:bg-purple-50 dark:hover:bg-purple-900/20
                               border border-transparent hover:border-purple-200 dark:hover:border-purple-800
                               transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600
                                    flex items-center justify-center shadow-lg shadow-purple-500/20
                                    group-hover:scale-110 group-hover:shadow-purple-500/30
                                    transition-all duration-200">
                      <Linkedin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        LinkedIn
                      </p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 truncate
                                    group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        View Profile
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}

                {/* Portfolio */}
                {profile.portfolio_url && (
                  <a
                    href={profile.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50
                               hover:bg-purple-50 dark:hover:bg-purple-900/20
                               border border-transparent hover:border-purple-200 dark:hover:border-purple-800
                               transition-all duration-200 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600
                                    flex items-center justify-center shadow-lg shadow-purple-500/20
                                    group-hover:scale-110 group-hover:shadow-purple-500/30
                                    transition-all duration-200">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-0.5">
                        Portfolio
                      </p>
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 truncate
                                    group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Visit Website
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all duration-200"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </CardContent>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30
                            border-t border-gray-200/50 dark:border-gray-700/50">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Powered by{' '}
                <a
                  href="https://rethink.systems"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-purple-600 dark:text-purple-400
                             hover:text-purple-700 dark:hover:text-purple-300
                             transition-colors duration-200 hover:underline underline-offset-2"
                >
                  Rethink Systems
                </a>
              </p>
            </div>
          </Card>

          {/* Subtle branding watermark */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
            Create your own shareable profile card at rethink.systems
          </p>
        </div>
      </div>
    </div>
  );
}
