import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome banner skeleton */}
      <Card className="relative overflow-hidden border-2">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/30 via-teal-400/30 to-teal-500/30" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions card */}
        <Card className="relative overflow-hidden border-2">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/30 via-teal-400/30 to-teal-500/30" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-5 w-40" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Learnings card */}
        <Card className="relative overflow-hidden border-2">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500/30 via-teal-400/30 to-teal-500/30" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Resources skeleton */}
      <Card className="relative overflow-hidden border-2">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500/30 via-emerald-500/30 to-green-500/30" />
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-5 w-36" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 p-4 rounded-xl border">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
