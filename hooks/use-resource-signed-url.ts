import { useState, useEffect } from 'react';
import type { ModuleResource } from '@/types';

interface UseResourceSignedUrlResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch signed URLs for PDF resources from Supabase Storage
 *
 * Only fetches for resources with file_path (uploaded PDFs, not YouTube videos)
 * Signed URLs expire after 15 minutes, regenerated on each call
 *
 * @param resource - The resource to fetch signed URL for
 * @returns Object with url, loading state, error state, and refetch function
 */
export function useResourceSignedUrl(resource: ModuleResource | null): UseResourceSignedUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    // Reset state if no resource
    if (!resource) {
      setUrl(null);
      setError(null);
      return;
    }

    // Only fetch for PDFs with file_path (uploaded to Supabase Storage)
    // Videos use YouTube URLs directly, no signed URL needed
    if (!resource.file_path || resource.content_type === 'video') {
      setUrl(null);
      setError(null);
      return;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/module-resources/${resource.id}/signed-url`);

        if (response.ok) {
          const data = await response.json();
          setUrl(data.url);
          console.log('[useResourceSignedUrl] PDF signed URL fetched:', {
            title: resource.title,
            urlPrefix: data.url.substring(0, 80) + '...'
          });
        } else {
          const errorMessage = `Failed to fetch signed URL (${response.status})`;
          console.error('[useResourceSignedUrl]', errorMessage);
          setError(errorMessage);
          setUrl(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';
        console.error('[useResourceSignedUrl] Error fetching signed URL:', err);
        setError(errorMessage);
        setUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [resource?.id, resource?.file_path, resource?.content_type, refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return { url, loading, error, refetch };
}
