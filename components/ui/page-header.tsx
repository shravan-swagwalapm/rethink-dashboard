import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface PageHeaderProps {
  icon?: LucideIcon
  iconColor?: "teal" | "success" | "warning" | "danger" | "info"
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function PageHeader({
  icon: Icon,
  iconColor = "teal",
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-8", className)}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={cn("icon-container", `icon-${iconColor}`)}>
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps }
