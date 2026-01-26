'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getGoogleDriveVideoUrl } from '@/lib/utils/google-drive-url';
import { useVideoProgress } from './useVideoProgress';
import { Loader2, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CaptionTrack } from '@/types';

// Dynamic import of Video.js to avoid SSR issues
// Note: CSS is imported in globals.css
let videojs: any = null;
if (typeof window !== 'undefined') {
  import('video.js').then((module) => {
    videojs = module.default;
  });
}

export interface VideoPlayerProps {
  googleDriveId: string;
  resourceId: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  onProgress?: (seconds: number, percentage: number) => void;
  onComplete?: () => void;
  autoplay?: boolean;
  captions?: CaptionTrack[];
}

export function VideoPlayer({
  googleDriveId,
  resourceId,
  title,
  duration,
  thumbnail,
  onProgress,
  onComplete,
  autoplay = false,
  captions = [],
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoJsReady, setIsVideoJsReady] = useState(false);

  const {
    progress,
    saveProgress,
    markComplete,
  } = useVideoProgress(resourceId);

  // Wait for Video.js to be loaded
  useEffect(() => {
    const checkVideoJs = setInterval(() => {
      if (videojs) {
        setIsVideoJsReady(true);
        clearInterval(checkVideoJs);
      }
    }, 100);

    return () => clearInterval(checkVideoJs);
  }, []);

  // Fetch Google Drive video URL
  useEffect(() => {
    const fetchUrl = async () => {
      try {
        setIsLoading(true);
        const result = getGoogleDriveVideoUrl(googleDriveId, true);
        setVideoUrl(result.url);
        setError(null);
      } catch (err) {
        console.error('Failed to generate video URL:', err);
        setError('Failed to load video URL');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUrl();
  }, [googleDriveId]);

  // Save progress handler
  const handleProgressSave = useCallback(() => {
    if (!playerRef.current) return;

    try {
      const currentTime = playerRef.current.currentTime() || 0;
      const videoDuration = playerRef.current.duration() || duration || 0;
      const percentage = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

      // Save to database
      saveProgress(Math.floor(currentTime), Number(percentage.toFixed(2)));

      // Call optional callback
      onProgress?.(currentTime, percentage);

      // Mark as complete if watched 90% or more
      if (percentage >= 90 && !progress?.completed) {
        markComplete();
        onComplete?.();
      }
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }, [saveProgress, onProgress, markComplete, onComplete, progress, duration]);

  // Initialize Video.js player
  useEffect(() => {
    if (!videoRef.current || !videoUrl || !isVideoJsReady || !videojs) return;

    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      poster: thumbnail,
      autoplay,
      preload: 'metadata',
      sources: [{
        src: videoUrl,
        type: 'video/mp4',
      }],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'playbackRateMenuButton',
          'chaptersButton',
          'descriptionsButton',
          'subsCapsButton',
          'audioTrackButton',
          'pictureInPictureToggle',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Resume from last position
    player.ready(() => {
      if (progress && progress.last_position_seconds > 5) {
        player.currentTime(progress.last_position_seconds);
      }

      // Add captions if provided
      if (captions && captions.length > 0) {
        captions.forEach((caption) => {
          player.addRemoteTextTrack({
            kind: 'subtitles',
            src: caption.src,
            srclang: caption.srclang,
            label: caption.label,
            default: caption.default || false,
          }, false);
        });
      }
    });

    // Progress tracking (save every 5 seconds)
    player.on('play', () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      progressIntervalRef.current = setInterval(() => {
        handleProgressSave();
      }, 5000);
    });

    player.on('pause', () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Save immediately on pause
      handleProgressSave();
    });

    player.on('ended', () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      // Mark as complete
      markComplete();
      onComplete?.();
    });

    // Error handling
    player.on('error', (e: any) => {
      const error = player.error();
      console.error('Video.js error:', error);

      if (error) {
        setError(`Failed to load video: ${error.message || 'Unknown error'}`);
      }
    });

    // Cleanup
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }

      // Save one last time before cleanup
      handleProgressSave();

      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (error) {
          console.error('Error disposing player:', error);
        }
        playerRef.current = null;
      }
    };
  }, [videoUrl, isVideoJsReady, progress, resourceId, thumbnail, autoplay, captions, handleProgressSave, markComplete, onComplete]);

  // Loading state
  if (isLoading || !isVideoJsReady) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading video player...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="aspect-video bg-destructive/10 rounded-lg border border-destructive/50 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load video</h3>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  // Main video player
  return (
    <div className="video-player-container space-y-3">
      <div data-vjs-player className="rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-theme-rethink"
        />
      </div>

      {/* Progress indicator */}
      {progress && progress.last_position_seconds > 5 && !progress.completed && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
          <Play className="w-4 h-4" />
          <span>
            Resume from{' '}
            <span className="font-medium text-foreground">
              {Math.floor(progress.last_position_seconds / 60)}:
              {String(Math.floor(progress.last_position_seconds % 60)).padStart(2, '0')}
            </span>
            {' '}({Math.round(progress.watch_percentage)}% watched)
          </span>
        </div>
      )}

      {/* Completion indicator */}
      {progress?.completed && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 px-4 py-2 rounded-lg">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span>You completed this video</span>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Keyboard shortcuts:</span> Space (play/pause) • → (forward 10s) • ← (backward 10s) • F (fullscreen) • M (mute)
      </div>
    </div>
  );
}
