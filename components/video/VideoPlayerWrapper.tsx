'use client';

import { Component, ReactNode, useEffect } from 'react';
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

  const fallback = (
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 right-4 z-10 bg-yellow-500/90 text-yellow-900 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>Enhanced player unavailable. Using basic player.</span>
      </div>
      <iframe
        src={iframeUrl}
        className="w-full h-full"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    </div>
  );

  return (
    <VideoPlayerErrorBoundary fallback={fallback}>
      <VideoPlayer {...props} />
    </VideoPlayerErrorBoundary>
  );
}
