'use client';

import { Component, ReactNode, useEffect, useState } from 'react';
import { VideoPlayer, VideoPlayerProps } from './VideoPlayer';
import { AlertCircle } from 'lucide-react';

// Import Video.js CSS - loads from local node_modules
import 'video.js/dist/video-js.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class VideoPlayerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('VideoPlayer Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

interface VideoPlayerWrapperProps extends VideoPlayerProps {
  googleDriveId: string;
}

export function VideoPlayerWrapper(props: VideoPlayerWrapperProps) {
  const iframeUrl = `https://drive.google.com/file/d/${props.googleDriveId}/preview`;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Ensure component is mounted before rendering VideoPlayer
    setMounted(true);
  }, []);

  const fallback = (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
      <iframe
        src={iframeUrl}
        className="w-full h-full"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    </div>
  );

  // Don't render VideoPlayer until component is mounted
  if (!mounted) {
    return (
      <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading player...</p>
        </div>
      </div>
    );
  }

  return (
    <VideoPlayerErrorBoundary fallback={fallback}>
      <VideoPlayer {...props} />
    </VideoPlayerErrorBoundary>
  );
}
