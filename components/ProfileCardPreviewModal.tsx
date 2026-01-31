'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Globe, Linkedin, MapPin } from 'lucide-react';
import { Profile } from '@/types';

interface ProfileCardPreviewModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

export function ProfileCardPreviewModal({ open, onClose, profile }: ProfileCardPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Profile Card Preview</DialogTitle>
        </DialogHeader>

        {/* Profile Card - Same design as public page but slightly smaller */}
        <div className="p-6 pt-4">
          <div className="border-2 border-purple-200 dark:border-purple-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Header Gradient */}
            <div className="h-24 bg-gradient-to-r from-purple-500 to-purple-600" />

            <div className="relative pt-0 pb-6 px-6">
              {/* Avatar */}
              <div className="relative -mt-12 mb-4">
                <div className="w-24 h-24 mx-auto rounded-2xl bg-white dark:bg-gray-800 p-1.5 shadow-xl">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || 'Profile'}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-gray-700 flex items-center justify-center">
                      <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {profile.full_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name and Role */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {profile.full_name || 'No Name Provided'}
                </h2>
                <Badge variant="secondary" className="text-xs">
                  {profile.role === 'student' ? 'Student' :
                   profile.role === 'mentor' ? 'Mentor' :
                   profile.role === 'admin' ? 'Admin' :
                   profile.role === 'company_user' ? 'Company User' :
                   profile.role === 'master' ? 'Master' : 'User'}
                </Badge>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                {/* Email */}
                {profile.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Email</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {profile.email}
                      </p>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {profile.phone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Phone</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {profile.phone}
                      </p>
                    </div>
                  </div>
                )}

                {/* Timezone */}
                {profile.timezone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Timezone</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {profile.timezone}
                      </p>
                    </div>
                  </div>
                )}

                {/* LinkedIn */}
                {profile.linkedin_url && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Linkedin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">LinkedIn</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        View Profile
                      </p>
                    </div>
                  </div>
                )}

                {/* Portfolio */}
                {profile.portfolio_url && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Portfolio</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        Visit Website
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-xs text-gray-600 dark:text-gray-400">
                Powered by{' '}
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  Rethink Systems
                </span>
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
