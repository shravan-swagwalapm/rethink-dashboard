import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "before:animate-[shimmer_2s_infinite]",
        className
      )}
      {...props}
    />
  )
}

/**
 * SkeletonMorph wraps skeleton→content transitions with a smooth crossfade.
 * Usage:
 *   <SkeletonMorph loading={isLoading} skeleton={<Skeleton className="h-8 w-32" />}>
 *     <h2>{data.title}</h2>
 *   </SkeletonMorph>
 */
function SkeletonMorph({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {loading ? (
        <div className="animate-in fade-in duration-200">
          {skeleton}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {children}
        </div>
      )}
    </div>
  )
}

export { Skeleton, SkeletonMorph }
