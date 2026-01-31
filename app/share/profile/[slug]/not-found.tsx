import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950/20">
      {/* Animated background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-300/20 dark:bg-red-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex items-center justify-center min-h-screen px-4 py-12">
        <div className="text-center space-y-8 max-w-md">
          {/* Error Icon with animation */}
          <div className="relative inline-flex">
            <div className="absolute inset-0 bg-red-500/20 dark:bg-red-500/10 rounded-full blur-xl animate-pulse" />
            <div className="relative w-28 h-28 mx-auto rounded-full bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/20
                            flex items-center justify-center shadow-lg shadow-red-500/10
                            ring-4 ring-red-100 dark:ring-red-900/20">
              <AlertCircle className="w-14 h-14 text-red-500 dark:text-red-400" />
            </div>
          </div>

          {/* Error Message */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Profile Not Found
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              This profile link is invalid or has been deactivated by the owner.
            </p>
          </div>

          {/* Helpful suggestions */}
          <div className="bg-white/60 dark:bg-gray-800/40 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              What you can do:
            </h2>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span>Check if the URL was copied correctly</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span>Ask the owner for a new profile link</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span>The profile may have been deactivated</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-purple-600
                         hover:from-purple-600 hover:to-purple-700
                         shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40
                         transition-all duration-200 text-white font-medium px-6"
            >
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go to Homepage
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto border-2 border-gray-200 dark:border-gray-700
                         hover:border-purple-300 dark:hover:border-purple-700
                         hover:bg-purple-50 dark:hover:bg-purple-900/20
                         transition-all duration-200"
            >
              <Link href="javascript:history.back()">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Link>
            </Button>
          </div>

          {/* Footer */}
          <p className="text-sm text-gray-500 dark:text-gray-400 pt-4">
            Need help?{' '}
            <a
              href="https://rethink.systems"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-purple-600 dark:text-purple-400 hover:underline underline-offset-2"
            >
              Contact Rethink Systems
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
