'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service in production
    // For now, we'll just capture it without console logging
    if (process.env.NODE_ENV === 'production' && error.digest) {
      // TODO: Send to error tracking service (e.g., Sentry)
      // trackError({ message: error.message, digest: error.digest });
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription className="text-base mt-2">
            We encountered an error while loading the login page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive mb-2">Error Details (Development Only):</p>
              <p className="text-sm text-muted-foreground break-words">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={reset}
              className="flex-1 gradient-bg hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="flex-1"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-4">
            If this problem persists, please contact{' '}
            <a href="mailto:shravan@naum.systems" className="text-primary hover:underline">
              shravan@naum.systems
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
