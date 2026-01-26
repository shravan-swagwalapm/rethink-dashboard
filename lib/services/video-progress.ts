/**
 * Video Progress Service
 *
 * Service layer for managing video progress tracking
 * Handles CRUD operations for video_progress table
 */

import { getClient } from '@/lib/supabase/client';
import type { VideoProgress } from '@/types';

class VideoProgressService {
  /**
   * Get progress for a specific resource
   */
  async getProgress(resourceId: string): Promise<VideoProgress | null> {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('resource_id', resourceId)
        .single();

      if (error) {
        // PGRST116 is "not found" error, which is expected if no progress exists yet
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching video progress:', error);
      return null;
    }
  }

  /**
   * Save or update progress
   */
  async saveProgress(
    resourceId: string,
    positionSeconds: number,
    watchPercentage: number
  ): Promise<void> {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user');
      return;
    }

    try {
      const { error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          resource_id: resourceId,
          last_position_seconds: Math.floor(positionSeconds),
          watch_percentage: Math.round(watchPercentage * 100) / 100,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,resource_id',
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving video progress:', error);
      throw error;
    }
  }

  /**
   * Mark video as completed
   */
  async markCompleted(resourceId: string): Promise<void> {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user');
      return;
    }

    try {
      const { error } = await supabase
        .from('video_progress')
        .upsert({
          user_id: user.id,
          resource_id: resourceId,
          completed: true,
          completed_at: new Date().toISOString(),
          watch_percentage: 100,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,resource_id',
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error marking video complete:', error);
      throw error;
    }
  }

  /**
   * Get all progress for current user
   */
  async getAllProgress(): Promise<VideoProgress[]> {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching all progress:', error);
      return [];
    }
  }

  /**
   * Get completion statistics for a user
   */
  async getCompletionStats(userId?: string): Promise<{
    totalVideos: number;
    completedVideos: number;
    inProgressVideos: number;
    completionRate: number;
  }> {
    const supabase = getClient();
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          totalVideos: 0,
          completedVideos: 0,
          inProgressVideos: 0,
          completionRate: 0,
        };
      }
      targetUserId = user.id;
    }

    try {
      const { data, error } = await supabase
        .from('video_progress')
        .select('completed')
        .eq('user_id', targetUserId);

      if (error) {
        throw error;
      }

      const totalVideos = data?.length || 0;
      const completedVideos = data?.filter((p: VideoProgress) => p.completed).length || 0;
      const inProgressVideos = totalVideos - completedVideos;
      const completionRate = totalVideos > 0 ? (completedVideos / totalVideos) * 100 : 0;

      return {
        totalVideos,
        completedVideos,
        inProgressVideos,
        completionRate: Math.round(completionRate),
      };
    } catch (error) {
      console.error('Error fetching completion stats:', error);
      return {
        totalVideos: 0,
        completedVideos: 0,
        inProgressVideos: 0,
        completionRate: 0,
      };
    }
  }

  /**
   * Delete progress for a specific resource (useful for resetting)
   */
  async deleteProgress(resourceId: string): Promise<void> {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user');
      return;
    }

    try {
      const { error } = await supabase
        .from('video_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('resource_id', resourceId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting video progress:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoProgressService = new VideoProgressService();
