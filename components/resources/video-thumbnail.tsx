'use client';

import { Play } from 'lucide-react';

interface VideoThumbnailProps {
  title: string;
  thumbnailUrl?: string | null;
  duration?: string | null;
}

export function VideoThumbnail({ title, thumbnailUrl, duration }: VideoThumbnailProps) {
  if (thumbnailUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg group">
        <img
          src={thumbnailUrl}
          alt={title}
          className="object-cover w-full h-full transition-transform group-hover:scale-105"
        />
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {duration}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
      </div>
    );
  }

  // Custom gradient fallback when no thumbnail
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary/80 to-accent p-6 flex items-center justify-center group">
      <h3 className="text-white text-center font-bold text-lg line-clamp-3 px-4">
        {title}
      </h3>
      {duration && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {duration}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <Play className="w-8 h-8 text-white ml-1" fill="white" />
        </div>
      </div>
    </div>
  );
}
