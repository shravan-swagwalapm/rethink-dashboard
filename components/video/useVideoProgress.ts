import { useEffect, useState, useCallback, useRef } from 'react';
import { videoProgressService } from '@/lib/services/video-progress';
import type { VideoProgress } from '@/types';

/**
 * Hook for managing video progress tracking
 *
 * Loads progress on mount, provides methods to save progress and mark completion
 */
export function useVideoProgress(resourceId: string) {
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load progress on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        const data = await videoProgressService.getProgress(resourceId);
        setProgress(data);
      } catch (error) {
        console.error('Error loading video progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [resourceId]);

  // Debounced save function to prevent excessive API calls
  const saveProgress = useCallback(
    (positionSeconds: number, watchPercentage: number) => {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the save by 1 second
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await videoProgressService.saveProgress(
            resourceId,
            positionSeconds,
            watchPercentage
          );

          // Update local state
          setProgress((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              last_position_seconds: positionSeconds,
              watch_percentage: watchPercentage,
              last_watched_at: new Date().toISOString(),
            };
          });
        } catch (error) {
          console.error('Error saving video progress:', error);
        }
      }, 1000);
    },
    [resourceId]
  );

  // Mark video as completed
  const markComplete = useCallback(async () => {
    try {
      await videoProgressService.markCompleted(resourceId);

      setProgress((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          completed: true,
          completed_at: new Date().toISOString(),
          watch_percentage: 100,
        };
      });
    } catch (error) {
      console.error('Error marking video complete:', error);
    }
  }, [resourceId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    progress,
    loading,
    saveProgress,
    markComplete,
  };
}
