'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Globe, Linkedin, MapPin, Sparkles, X } from 'lucide-react';
import { Profile } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserContext } from '@/contexts/user-context';

interface ProfileCardPreviewModalProps {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}

export function ProfileCardPreviewModal({ open, onClose, profile }: ProfileCardPreviewModalProps) {
  const { activeRole } = useUserContext();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 bg-transparent border-none shadow-none overflow-visible">
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{
                type: "spring",
                damping: 25,
                stiffness: 300,
                duration: 0.4
              }}
              className="relative"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute -top-4 -right-4 z-50 w-10 h-10 rounded-full bg-gray-900/90 backdrop-blur-xl border-2 border-purple-500/50 text-white hover:bg-gray-800 hover:border-purple-400 transition-all hover:scale-110 flex items-center justify-center group shadow-lg shadow-purple-500/25"
              >
                <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              </button>

              {/* Main Card Container */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-500/30 shadow-2xl shadow-purple-500/25">

                {/* Animated Background Gradient Blobs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <motion.div
                    className="absolute -top-40 -left-40 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <motion.div
                    className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-600/30 rounded-full blur-3xl"
                    animate={{
                      scale: [1.2, 1, 1.2],
                      opacity: [0.5, 0.3, 0.5],
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                  />
                </div>

                {/* Glassmorphism Overlay */}
                <div className="relative backdrop-blur-xl bg-white/5 border-t border-white/10">

                  {/* Top Section: Profile Image */}
                  <div className="relative pt-12 pb-8 px-8">
                    {/* Sparkle Icon */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="absolute top-6 right-6"
                    >
                      <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                    </motion.div>

                    {/* Floating Profile Image */}
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: 0.2,
                        type: "spring",
                        damping: 20,
                        stiffness: 200
                      }}
                      className="relative mx-auto w-32 h-32"
                    >
                      {/* Glow Ring */}
                      <motion.div
                        className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500"
                        animate={{
                          rotate: [0, 360],
                          scale: [1, 1.05, 1],
                        }}
                        transition={{
                          rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                        }}
                        style={{ padding: '3px' }}
                      >
                        <div className="w-full h-full rounded-3xl bg-gray-900" />
                      </motion.div>

                      {/* Profile Image Container */}
                      <div className="absolute inset-0 p-[3px]">
                        <div className="w-full h-full rounded-3xl overflow-hidden bg-gradient-to-br from-purple-100 to-cyan-100 dark:from-purple-900/30 dark:to-cyan-900/30 shadow-xl shadow-purple-500/50">
                          {profile.avatar_url ? (
                            <motion.img
                              src={profile.avatar_url}
                              alt={profile.full_name || 'Profile'}
                              className="w-full h-full object-cover"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.4, duration: 0.5 }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <motion.span
                                className="text-5xl font-bold bg-gradient-to-br from-purple-600 to-cyan-600 bg-clip-text text-transparent"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.4, type: "spring" }}
                              >
                                {profile.full_name?.charAt(0).toUpperCase() || '?'}
                              </motion.span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Name and Role */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="text-center mt-6 space-y-3"
                    >
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                        {profile.full_name || 'No Name Provided'}
                      </h2>
                      <Badge className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-purple-500/50 text-purple-200 backdrop-blur-sm">
                        {activeRole === 'student' ? 'Student' :
                         activeRole === 'mentor' ? 'Mentor' :
                         activeRole === 'admin' ? 'Admin' :
                         activeRole === 'company_user' ? 'Admin' : 'User'}
                      </Badge>
                    </motion.div>
                  </div>

                  {/* Contact Information Section */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="px-8 pb-8 space-y-3"
                  >
                    {/* Email */}
                    {profile.email && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45, duration: 0.4 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 hover:border-purple-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Mail className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Email</p>
                          <p className="text-sm text-white truncate mt-0.5">{profile.email}</p>
                        </div>
                        <motion.div
                          className="w-2 h-2 rounded-full bg-purple-400"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </motion.div>
                    )}

                    {/* Phone */}
                    {profile.phone && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Phone className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Phone</p>
                          <p className="text-sm text-white mt-0.5">{profile.phone}</p>
                        </div>
                        <motion.div
                          className="w-2 h-2 rounded-full bg-cyan-400"
                          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        />
                      </motion.div>
                    )}

                    {/* Timezone */}
                    {profile.timezone && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55, duration: 0.4 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 to-transparent border border-pink-500/20 hover:border-pink-500/50 backdrop-blur-sm transition-all duration-300"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-pink-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Timezone</p>
                          <p className="text-sm text-white mt-0.5">{profile.timezone}</p>
                        </div>
                      </motion.div>
                    )}

                    {/* LinkedIn */}
                    {profile.linkedin_url && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 hover:border-blue-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Linkedin className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">LinkedIn</p>
                          <p className="text-sm text-white truncate mt-0.5">View Profile</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Portfolio */}
                    {profile.portfolio_url && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65, duration: 0.4 }}
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 hover:border-emerald-500/50 backdrop-blur-sm transition-all duration-300 cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Globe className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Portfolio</p>
                          <p className="text-sm text-white truncate mt-0.5">Visit Website</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Footer */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.5 }}
                    className="px-8 py-4 border-t border-white/10 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 backdrop-blur-sm"
                  >
                    <p className="text-center text-xs text-gray-400">
                      Powered by{' '}
                      <span className="font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                        Rethink Systems
                      </span>
                    </p>
                  </motion.div>

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
