'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ExternalLink, Mail, Phone, Linkedin } from 'lucide-react';
import type { Profile } from '@/types';

interface ProfileDetailSheetProps {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'linkedin_url' | 'portfolio_url'> | null;
  role?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDetailSheet({ profile, role, open, onOpenChange }: ProfileDetailSheetProps) {
  if (!profile) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback className="gradient-bg text-white text-2xl">
              {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{profile.full_name || 'User'}</h2>
          {role && <Badge className="mt-1 capitalize">{role}</Badge>}
        </div>

        <div className="mt-8 space-y-4 flex flex-col items-center">
          {profile.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${profile.email}`} className="text-sm hover:underline truncate">
                {profile.email}
              </a>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={`tel:${profile.phone}`} className="text-sm hover:underline">
                {profile.phone}
              </a>
            </div>
          )}
          {profile.linkedin_url && (
            <div className="flex items-center gap-3">
              <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                LinkedIn Profile
              </a>
            </div>
          )}
          {profile.portfolio_url && (
            <div className="flex items-center gap-3">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                Portfolio
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
