import { notFound } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { Mail, Phone, Globe, Linkedin, MapPin, Sparkles } from 'lucide-react';
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

  // Use adminClient to bypass RLS — profile_cards lookup already validated the slug
  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
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

  // Fetch user profile — use adminClient to bypass RLS (user_id is trusted DB data from profile_cards)
  const adminClient = await createAdminClient();
  const { data: profile, error: profileError } = await adminClient
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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center py-12 px-4">
      {/* Animated Background Gradient Blobs - Static versions */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-600/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Main Card Container */}
      <div className="relative w-full max-w-lg">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-500/30 shadow-2xl shadow-purple-500/25">

          {/* Background Gradient Blobs inside card */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-600/30 rounded-full blur-3xl" />
          </div>

          {/* Glassmorphism Overlay */}
          <div className="relative backdrop-blur-xl bg-white/5 border-t border-white/10">

            {/* Top Section: Profile Image */}
            <div className="relative pt-12 pb-8 px-8">
              {/* Sparkle Icon */}
              <div className="absolute top-6 right-6">
                <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
              </div>

              {/* Profile Image with Rainbow Glow Ring */}
              <div className="relative mx-auto w-32 h-32">
                {/* Static Glow Ring - rainbow gradient */}
                <div
                  className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 shadow-lg shadow-purple-500/50"
                  style={{ padding: '3px' }}
                >
                  <div className="w-full h-full rounded-3xl bg-gray-900" />
                </div>

                {/* Profile Image Container */}
                <div className="absolute inset-0 p-[3px]">
                  <div className="w-full h-full rounded-3xl overflow-hidden bg-gradient-to-br from-purple-900/30 to-cyan-900/30 shadow-xl shadow-purple-500/50">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || 'Profile'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl font-bold bg-gradient-to-br from-purple-600 to-cyan-600 bg-clip-text text-transparent">
                          {profile.full_name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Name and Role */}
              <div className="text-center mt-6 space-y-3">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                  {profile.full_name || 'No Name Provided'}
                </h2>
                <Badge className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-purple-500/50 text-purple-200 backdrop-blur-sm">
                  {getRoleDisplay(profile.role)}
                </Badge>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="px-8 pb-8 space-y-3">
              {/* Email */}
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Email</p>
                    <p className="text-sm text-white truncate mt-0.5">{profile.email}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                </a>
              )}

              {/* Phone */}
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Phone className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Phone</p>
                    <p className="text-sm text-white mt-0.5">{profile.phone}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                </a>
              )}

              {/* Timezone */}
              {profile.timezone && (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 to-transparent border border-pink-500/20 hover:border-pink-500/50 backdrop-blur-sm transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Timezone</p>
                    <p className="text-sm text-white mt-0.5">{profile.timezone}</p>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 hover:border-blue-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Linkedin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">LinkedIn</p>
                    <p className="text-sm text-white truncate mt-0.5">View Profile</p>
                  </div>
                </a>
              )}

              {/* Portfolio */}
              {profile.portfolio_url && (
                <a
                  href={profile.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Globe className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Portfolio</p>
                    <p className="text-sm text-white truncate mt-0.5">Visit Website</p>
                  </div>
                </a>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-white/10 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 backdrop-blur-sm">
              <p className="text-center text-xs text-gray-400">
                Powered by{' '}
                <a
                  href="https://rethink.systems"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent hover:from-purple-300 hover:to-cyan-300 transition-all"
                >
                  Rethink Systems
                </a>
              </p>
            </div>

          </div>
        </div>

        {/* Subtle branding watermark */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Create your own shareable profile card at rethink.systems
        </p>
      </div>
    </div>
  );
}
