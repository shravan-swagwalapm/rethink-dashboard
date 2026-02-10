import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 dot-pattern rounded-xl",
        className
      )}
    >
      {Icon && (
        <div className="icon-container icon-teal size-12 mb-4">
          <Icon className="size-6 opacity-60" />
        </div>
      )}
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm text-center max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
